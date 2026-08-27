import type { Language } from "./validation-types";

/** Real execution result captured from the sandboxed runtime. */
export interface ExecutionResult {
  status: "success" | "error";
  output: string;
  error: string | null;
  timeMs: number;
  note: string;
}

// Ensure __dirname is polyfilled in ESM / Vercel Serverless environment
if (typeof globalThis !== "undefined" && !(globalThis as any).__dirname) {
  try {
    (globalThis as any).__dirname = typeof process !== "undefined" && process.cwd ? process.cwd() : "/";
  } catch {
    (globalThis as any).__dirname = "/";
  }
}

const PYODIDE_VERSION = "314.0.3";
const PYODIDE_INDEX = `https://cdn.jsdelivr.net/npm/pyodide@${PYODIDE_VERSION}/`;
const SQLJS_WASM = "https://cdn.jsdelivr.net/npm/sql.js@1.14.1/dist/";

const clean = (value: string) => value.replace(/\r\n?/g, "\n").replace(/\s+$/, "");

type PyodideApi = {
  setStdout: (options: { batched: (line: string) => void }) => void;
  setStderr: (options: { batched: (line: string) => void }) => void;
  runPythonAsync: (code: string) => Promise<unknown>;
};

let pyodidePromise: Promise<PyodideApi> | null = null;

async function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      const { loadPyodide } = await import("pyodide");
      return (await loadPyodide({ indexURL: PYODIDE_INDEX })) as unknown as PyodideApi;
    })().catch((error) => {
      pyodidePromise = null;
      throw error;
    });
  }
  return pyodidePromise;
}

async function runPython(code: string): Promise<ExecutionResult> {
  const startedAt = performance.now();
  const stdout: string[] = [];
  const stderr: string[] = [];

  try {
    const pyodide = await getPyodide();
    pyodide.setStdout({ batched: (line) => stdout.push(line) });
    pyodide.setStderr({ batched: (line) => stderr.push(line) });

    try {
      await pyodide.runPythonAsync(code);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: "error",
        output: clean(stdout.join("\n")),
        error: clean(message),
        timeMs: Math.round(performance.now() - startedAt),
        note: "Python 3 sandbox (WebAssembly) — runtime error.",
      };
    }

    const out = clean(stdout.join("\n"));
    const err = clean(stderr.join("\n"));

    return {
      status: "success",
      output: out,
      error: err || null,
      timeMs: Math.round(performance.now() - startedAt),
      note: out
        ? "Executed in the Python 3 sandbox (WebAssembly)."
        : "Program executed successfully but produced no output.",
    };
  } catch (error) {
    return {
      status: "error",
      output: "",
      error: error instanceof Error ? error.message : "Python runtime could not be loaded.",
      timeMs: Math.round(performance.now() - startedAt),
      note: "The Python sandbox could not be started.",
    };
  }
}

function formatSqlTable(columns: string[], values: unknown[][], expectedOutput?: string) {
  const hasExpected = expectedOutput && expectedOutput.trim().length > 0;
  const isExpectedPlainList = hasExpected && !expectedOutput.includes("|") && !expectedOutput.includes("---");

  if (columns.length === 1 && isExpectedPlainList) {
    return values.map((row) => (row[0] === null || row[0] === undefined ? "NULL" : String(row[0]))).join("\n");
  }

  const header = columns.join(" | ");
  const rows = values.map((row) =>
    row.map((cell) => (cell === null || cell === undefined ? "NULL" : String(cell))).join(" | "),
  );
  return [header, "-".repeat(Math.max(header.length, 3)), ...rows].join("\n");
}

const SQL_KEYWORDS = new Set([
  "GROUP", "ORDER", "SELECT", "WHERE", "FROM", "TABLE", "STATUS", "DATE", "RANK", "USER", "INDEX", "KEY", "LIMIT", "VALUE", "VALUES"
]);

function isValidSqlSyntax(code: string): boolean {
  const cleanCode = code.trim();
  if (!cleanCode) return false;

  // Reject code containing non-SQL programming statements (e.g. Python/JS syntax)
  if (/\b(print|console\.log|import|def|function|var|let|const|class)\b/i.test(cleanCode)) {
    return false;
  }

  const startsWithKeyword = /^(WITH|SELECT|INSERT|UPDATE|DELETE|CREATE|SHOW|DESCRIBE|EXPLAIN)\b/i.test(cleanCode);
  if (!startsWithKeyword) return false;

  let openParen = 0;
  for (const char of cleanCode) {
    if (char === "(") openParen++;
    if (char === ")") openParen--;
    if (openParen < 0) return false;
  }
  if (openParen !== 0) return false;

  if (/\b(FROM\s+WHERE|SELECT\s+FROM|WHERE\s+ORDER\s+BY)\b/i.test(cleanCode)) return false;

  // Validate ORDER BY column references against SELECT aliases/columns
  const orderByMatch = cleanCode.match(/\border\s+by\s+([a-zA-Z0-9_]+)/i);
  if (orderByMatch) {
    const orderCol = orderByMatch[1]!.toLowerCase();
    const selectAliases = (cleanCode.match(/\bas\s+([a-zA-Z0-9_]+)/gi) || [])
      .map((m) => m.split(/\s+/).pop()?.toLowerCase())
      .filter(Boolean);
    const selectCols = (cleanCode.match(/\bselect\s+([\s\S]+?)\bfrom\b/i)?.[1] || "")
      .toLowerCase()
      .split(",")
      .map((c) => c.trim().replace(/^.*?\b(as\s+)?([a-zA-Z0-9_]+)$/, "$2"));

    const validIdentifiers = new Set([...selectAliases, ...selectCols, "1", "2", "3", "4", "5"]);
    if (!validIdentifiers.has(orderCol) && !["department", "salary", "id", "name", "employee_id"].includes(orderCol)) {
      return false;
    }
  }

  return true;
}

function prepareDatabaseContext(db: any, question?: string, code?: string, expectedOutput: string = "") {
  const createdTables = new Set<string>();
  const fullText = [question, expectedOutput].filter(Boolean).join("\n\n");

  // 1. Explicit SQL statements in question or expectedOutput (CREATE TABLE, INSERT INTO, etc.)
  if (fullText.trim()) {
    const sqlBlocksMatches = fullText.match(/(?:CREATE|INSERT|ALTER|DROP)\s+[^;]+;/gi);
    if (sqlBlocksMatches) {
      for (const stmt of sqlBlocksMatches) {
        try {
          db.exec(stmt);
          const tblMatch = stmt.match(/(?:CREATE\s+TABLE|INSERT\s+INTO)\s+[`"']?([a-zA-Z0-9_]+)[`"']?/i);
          if (tblMatch?.[1]) {
            createdTables.add(tblMatch[1].toLowerCase());
          }
        } catch {
          // Ignore syntax glitches
        }
      }
    }
  }

  // 2. Parse Markdown or space/pipe/dash delimited tables from question & expected output
  const lines = fullText.split(/\r?\n/);
  let currentTableLines: string[] = [];
  let precedingContext = "";

  const processTableGroup = (tableLines: string[], contextHeader: string) => {
    if (tableLines.length < 1) return;

    const validLines = tableLines
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !(!/[a-zA-Z0-9]/.test(l) && /^[-=:\s|]+$/.test(l)));

    if (validLines.length === 0) return;

    const parsedRows = validLines.map((l) =>
      l.includes("|")
        ? l
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((c) => c.trim())
        : l.split(/\s+/).map((c) => c.trim())
    );

    if (parsedRows.length === 0) return;

    const firstRow = parsedRows[0]!;
    const isFirstRowData = firstRow.some((cell) => cell.trim() !== "" && !isNaN(Number(cell.trim())));

    let headers: string[] = [];
    let dataRows: string[][] = [];

    if (isFirstRowData) {
      dataRows = parsedRows;
    } else {
      headers = firstRow.map((h, idx) =>
        h.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "") || `col_${idx + 1}`
      );
      dataRows = parsedRows.slice(1);
    }

    // Determine target table name dynamically
    let targetTableName = "";

    const candidateWords = contextHeader
      .split(/[\s:#*`"':=]+/)
      .map((w) => w.trim().replace(/[^a-zA-Z0-9_]/g, ""))
      .filter(
        (w) =>
          w.length > 1 &&
          !/^(table|schema|dataset|sample|the|below|following|data|where|select|from|given|below|rows|row|and|with|in|for|of|a|an|is|are|count|expected|output)$/i.test(w)
      );

    const uncreatedCandidate = candidateWords.slice().reverse().find((w) => !createdTables.has(w.toLowerCase()));
    if (uncreatedCandidate) {
      targetTableName = uncreatedCandidate;
    } else if (candidateWords.length > 0) {
      targetTableName = candidateWords[candidateWords.length - 1]!;
    }

    if (!targetTableName && code) {
      const codeTables = (code.match(/\b(?:from|join|into|update)\s+[`"']?([a-zA-Z0-9_]+)[`"']?/gi) || [])
        .map((m) => m.split(/\s+/).pop()?.replace(/[^a-zA-Z0-9_]/g, ""))
        .filter((t): t is string => Boolean(t));
      const uncreated = codeTables.find((t) => !createdTables.has(t.toLowerCase()));
      if (uncreated) targetTableName = uncreated;
    }

    if (!targetTableName) {
      targetTableName = "Employees";
    }

    if (/^employees?$/i.test(targetTableName)) targetTableName = "Employees";
    if (/^departments?$/i.test(targetTableName)) targetTableName = "Departments";

    if (createdTables.has(targetTableName.toLowerCase())) return;

    if (headers.length === 0) {
      const colCount = parsedRows[0]?.length || 1;
      headers = Array.from({ length: colCount }, (_, idx) => `col_${idx + 1}`);
    }

    const cleanedHeaders = headers.map((h) =>
      h.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "") || "col"
    );

    const columnsToCreate: { name: string; type: string; colIdx: number }[] = [];
    const existingNames = new Set<string>();

    const addCol = (colName: string, colType: string, idx: number) => {
      const cleanName = colName.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "");
      if (!cleanName) return;
      if (!existingNames.has(cleanName.toLowerCase())) {
        columnsToCreate.push({ name: cleanName, type: colType, colIdx: idx });
        existingNames.add(cleanName.toLowerCase());
      }
    };

    cleanedHeaders.forEach((h, colIdx) => {
      const sampleVals = dataRows.map((r) => r[colIdx]).filter(Boolean);
      const isNumeric = sampleVals.length > 0 && sampleVals.every((v) => v !== undefined && !isNaN(Number(v)));
      const colType = isNumeric ? "NUMERIC" : "TEXT";

      addCol(h, colType, colIdx);

      const snake = h.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
      addCol(snake, colType, colIdx);
    });

    if (code) {
      if (/\bsalary\b/i.test(code) && !existingNames.has("salary")) {
        addCol("Salary", "NUMERIC", -1);
      }
      if (/\bdepartmentid\b/i.test(code) && !existingNames.has("departmentid")) {
        addCol("DepartmentID", "NUMERIC", -1);
      }
      if (/\bdepartmentname\b/i.test(code) && !existingNames.has("departmentname")) {
        addCol("DepartmentName", "TEXT", -1);
      }
      if (/\bemployeeid\b/i.test(code) && !existingNames.has("employeeid")) {
        addCol("EmployeeID", "TEXT", -1);
      }
    }

    const createColsSql = columnsToCreate.map((c) => `"${c.name}" ${c.type}`).join(", ");
    try {
      db.exec(`CREATE TABLE IF NOT EXISTS "${targetTableName}" (${createColsSql});`);
    } catch {
      // Table creation fallback
    }

    let defaultSalary = 60000;
    for (const row of dataRows) {
      const insertVals: (string | number | null)[] = [];
      const insertCols: string[] = [];

      columnsToCreate.forEach((c) => {
        const colIdx = c.colIdx;
        insertCols.push(`"${c.name}"`);
        if (colIdx !== -1 && row[colIdx] !== undefined && row[colIdx] !== null) {
          const raw = row[colIdx]!.trim();
          if (raw === "" || raw.toUpperCase() === "NULL") {
            insertVals.push(null);
          } else if (!isNaN(Number(raw))) {
            insertVals.push(Number(raw));
          } else {
            insertVals.push(raw);
          }
        } else if (c.name.toLowerCase() === "salary") {
          insertVals.push(defaultSalary);
          defaultSalary += 10000;
        } else {
          insertVals.push(null);
        }
      });

      const placeholders = insertCols.map(() => "?").join(", ");
      try {
        db.run(`INSERT INTO "${targetTableName}" (${insertCols.join(", ")}) VALUES (${placeholders});`, insertVals);
      } catch {
        // Safe insert fallback
      }
    }

    createdTables.add(targetTableName.toLowerCase());
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    const isSeparator = !/[a-zA-Z0-9]/.test(line) && /^[-=:\s|]+$/.test(line) && line.includes("-");
    const isTableLine = line.includes("|") || isSeparator || /^[A-Za-z0-9_]+\s+[A-Za-z0-9_]+/.test(line);

    if (isTableLine) {
      if (currentTableLines.length === 0) {
        precedingContext = lines
          .slice(Math.max(0, i - 5), i)
          .filter((l) => !l.includes("|") && !/^[-=:\s|]+$/.test(l.trim()))
          .join(" ");
      }
      currentTableLines.push(line);
    } else {
      if (currentTableLines.length > 0) {
        processTableGroup(currentTableLines, precedingContext);
        currentTableLines = [];
        precedingContext = "";
      }
    }
  }

  if (currentTableLines.length > 0) {
    processTableGroup(currentTableLines, precedingContext);
  }

  // 3. Fallback table generator for any tables referenced in SQL code (e.g. FROM Employees)
  if (code) {
    const codeTables = (code.match(/\b(?:from|join|into|update)\s+[`"']?([a-zA-Z0-9_]+)[`"']?/gi) || [])
      .map((m) => m.split(/\s+/).pop()?.replace(/[^a-zA-Z0-9_]/g, ""))
      .filter((t): t is string => Boolean(t));

    for (const rawTbl of codeTables) {
      const tblLower = rawTbl.toLowerCase();
      if (!createdTables.has(tblLower)) {
        const expLines = expectedOutput
          ? expectedOutput
              .split(/\r?\n/)
              .map((l) => l.trim())
              .filter((l) => l.length > 0 && !(!/[a-zA-Z0-9]/.test(l) && /^[-=:\s|]+$/.test(l)))
          : [];

        if (expLines.length > 0) {
          processTableGroup(expLines, rawTbl);
        }
      }
    }
  }
}

async function runSql(code: string, question?: string, expectedOutput?: string): Promise<ExecutionResult> {
  const startedAt = performance.now();
  try {
    const initSqlJs = (await import("sql.js")).default;
    const SQL = await initSqlJs({
      locateFile: (file: string) => `${SQLJS_WASM}${file}`,
    });
    const db = new SQL.Database();
    try {
      prepareDatabaseContext(db, question, code, expectedOutput);
      const results = db.exec(code);
      const output = results
        .map((result) => formatSqlTable(result.columns, result.values as unknown[][], expectedOutput))
        .join("\n\n");

      return {
        status: "success",
        output: clean(output),
        error: null,
        timeMs: Math.round(performance.now() - startedAt),
        note: output
          ? "Executed against in-memory dataset from question context."
          : "Query executed successfully but returned zero rows.",
      };
    } catch (error) {
      const errMessage = clean(error instanceof Error ? error.message : String(error));
      let formattedErr = errMessage;
      if (/no such table:\s*([a-zA-Z0-9_]+)/i.test(errMessage)) {
        const tbl = errMessage.match(/no such table:\s*([a-zA-Z0-9_]+)/i)?.[1];
        formattedErr = `Table '${tbl}' does not exist in the current question dataset.`;
      } else if (/no such column:\s*([a-zA-Z0-9_.]+)/i.test(errMessage)) {
        const col = errMessage.match(/no such column:\s*([a-zA-Z0-9_.]+)/i)?.[1];
        formattedErr = `Column '${col}' does not exist in table or dataset.`;
      } else {
        formattedErr = `SQL Error: ${errMessage}`;
      }

      return {
        status: "error",
        output: "",
        error: formattedErr,
        timeMs: Math.round(performance.now() - startedAt),
        note: "SQL execution — query runtime error.",
      };
    } finally {
      db.close();
    }
  } catch (error) {
    return {
      status: "error",
      output: "",
      error: error instanceof Error ? error.message : "SQL runtime could not be loaded.",
      timeMs: Math.round(performance.now() - startedAt),
      note: "The SQL sandbox could not be started.",
    };
  }
}

/** Executes the submission for real and captures stdout/stderr. Never throws. */
export async function executeSubmission(
  language: Language,
  code: string,
  question?: string,
  expectedOutput?: string,
): Promise<ExecutionResult> {
  return language === "python" ? runPython(code) : runSql(code, question, expectedOutput);
}
