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

  return true;
}

function prepareDatabaseContext(db: any, question?: string, code?: string, expectedOutput: string = "") {
  const createdTables = new Set<string>();
  const fullText = [question, expectedOutput].filter(Boolean).join("\n\n");
  if (!fullText.trim()) return;

  // 1. Explicit SQL DDL/DML statements (CREATE TABLE ..., INSERT INTO ...)
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
        // Ignore syntax issues in prose
      }
    }
  }

  // 2. Parse structured table groups from question & expected output
  const lines = fullText.split(/\r?\n/);
  let currentTableLines: string[] = [];
  let precedingContext = "";

  const processTableGroup = (tableLines: string[], contextHeader: string) => {
    if (tableLines.length < 1) return;

    // Filter out separator lines like '---'
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
        : l.split(/\s{2,}|\t/).map((c) => c.trim())
    );

    if (parsedRows.length === 0) return;

    const firstRow = parsedRows[0]!;
    const isFirstRowData = firstRow.some((cell) => cell.trim() !== "" && !isNaN(Number(cell.trim())));

    let headers: string[] = [];
    let dataRows: string[][] = [];

    if (isFirstRowData) {
      headers = firstRow.map((_, idx) => `col_${idx + 1}`);
      dataRows = parsedRows;
    } else {
      headers = firstRow.map((h, idx) =>
        h.replace(/[^a-zA-Z0-9_]/g, "").replace(/^_+|_+$/g, "") || `col_${idx + 1}`
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
          !/^(table|schema|dataset|sample|the|below|following|data|where|select|from|given|rows|row|and|with|in|for|of|a|an|is|are|count|expected|output|display|sort|by|write|query|to|names|whose|salary|greater|than|order|descending|ascending)$/i.test(w)
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

    if (!targetTableName) targetTableName = "Employees";

    if (/^employees?$/i.test(targetTableName)) targetTableName = "Employees";
    if (/^departments?$/i.test(targetTableName)) targetTableName = "Departments";

    if (createdTables.has(targetTableName.toLowerCase())) return;

    // Build Table Columns & Aliases
    const columnsToCreate: { name: string; type: string; colIdx: number }[] = [];
    const existingColNames = new Set<string>();

    const addCol = (colName: string, colType: string, idx: number) => {
      const clean = colName.replace(/[^a-zA-Z0-9_]/g, "").replace(/^_+|_+$/g, "");
      if (!clean) return;
      if (!existingColNames.has(clean.toLowerCase())) {
        columnsToCreate.push({ name: clean, type: colType, colIdx: idx });
        existingColNames.add(clean.toLowerCase());
      }
    };

    headers.forEach((h, colIdx) => {
      const sampleVals = dataRows.map((r) => r[colIdx]).filter((v) => v !== undefined && v !== "");
      const isNumeric = sampleVals.length > 0 && sampleVals.every((v) => !isNaN(Number(v)));
      const colType = isNumeric ? "NUMERIC" : "TEXT";

      addCol(h, colType, colIdx);

      // Add snake_case alias if original is PascalCase/camelCase (e.g. EmployeeName -> employee_name)
      const snake = h.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
      addCol(snake, colType, colIdx);
    });

    const createColsSql = columnsToCreate.map((c) => `"${c.name}" ${c.type}`).join(", ");
    try {
      db.exec(`CREATE TABLE IF NOT EXISTS "${targetTableName}" (${createColsSql});`);
    } catch {
      // Ignore fallback
    }

    // Insert Data Rows
    for (const row of dataRows) {
      if (row.length === 0 || (row.length === 1 && !row[0])) continue;
      const insertCols: string[] = [];
      const insertVals: (string | number | null)[] = [];

      columnsToCreate.forEach((c) => {
        if (c.colIdx !== -1 && row[c.colIdx] !== undefined) {
          insertCols.push(`"${c.name}"`);
          const valStr = row[c.colIdx]!.trim();
          if (valStr === "" || valStr.toUpperCase() === "NULL") {
            insertVals.push(null);
          } else if (!isNaN(Number(valStr))) {
            insertVals.push(Number(valStr));
          } else {
            insertVals.push(valStr);
          }
        }
      });

      if (insertCols.length > 0) {
        const placeholders = insertCols.map(() => "?").join(", ");
        try {
          db.run(`INSERT INTO "${targetTableName}" (${insertCols.join(", ")}) VALUES (${placeholders});`, insertVals);
        } catch {
          // Ignore fallback
        }
      }
    }

    createdTables.add(targetTableName.toLowerCase());
  };

  const isTableLine = (line: string) => {
    const l = line.trim();
    if (!l) return false;
    if (l.includes("|")) return true;
    if (/^[-=:\s|]+$/.test(l) && l.includes("-")) return true;
    if (/^(write|display|sort|find|select|create|given|question|instructions|expected|note|output|the|for|where|calculate|return|list|show)\b/i.test(l)) return false;
    if (/\.\s*$/.test(l) && !l.includes("|")) return false;
    if (/\t/.test(l)) return true;
    const multiSpaceParts = l.split(/\s{2,}/);
    return multiSpaceParts.length >= 2;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();

    if (isTableLine(line)) {
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
