import initSqlJs from "sql.js";

const question = `
Write an SQL query to display the names of employees whose salary is greater than 60000.

Display:

- EmployeeName
- DepartmentName
- Salary

Sort the result by Salary in descending order.

Employees:

EmployeeID | EmployeeName | DepartmentID | Salary
101 | Alice | 1 | 75000
102 | Bob | 2 | 45000
103 | Charlie | 1 | 60000
104 | David | 3 | 40000
105 | Emma | 2 | 55000
106 | Frank | 1 | 70000
107 | Grace | 3 | 65000

Departments:

DepartmentID | DepartmentName
1 | IT
2 | HR
3 | Finance
`;

const expectedOutput = `
EmployeeName | DepartmentName | Salary
Alice | IT | 75000
Frank | IT | 70000
Grace | Finance | 65000
`;

const code = `
SELECT
    e.EmployeeName,
    d.DepartmentName,
    e.Salary
FROM Employees e
JOIN Departments d
    ON e.DepartmentID = d.DepartmentID
WHERE e.Salary > 60000
ORDER BY e.Salary DESC;
`;

// Copy-paste the exact prepareDatabaseContext implementation from code-execution.ts
function prepareDatabaseContext(db: any, question?: string, code?: string, expectedOutput: string = "") {
  const createdTables = new Set<string>();
  const fullText = [question, expectedOutput].filter(Boolean).join("\n\n");

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
          // Ignore
        }
      }
    }
  }

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

    const createColsSql = columnsToCreate.map((c) => `"${c.name}" ${c.type}`).join(", ");
    db.exec(`CREATE TABLE IF NOT EXISTS "${targetTableName}" (${createColsSql});`);

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
        } else {
          insertVals.push(null);
        }
      });

      const placeholders = insertCols.map(() => "?").join(", ");
      db.run(`INSERT INTO "${targetTableName}" (${insertCols.join(", ")}) VALUES (${placeholders});`, insertVals);
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
}

async function test() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  prepareDatabaseContext(db, question, code, expectedOutput);

  console.log("--- Created Tables ---");
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table';");
  console.log(JSON.stringify(tables, null, 2));

  for (const t of tables[0]?.values || []) {
    const tblName = t[0];
    console.log(`\n--- Table: ${tblName} Schema ---`);
    console.log(JSON.stringify(db.exec(`PRAGMA table_info("${tblName}");`), null, 2));
    console.log(`--- Table: ${tblName} Content ---`);
    console.log(JSON.stringify(db.exec(`SELECT * FROM "${tblName}";`), null, 2));
  }

  console.log("\n--- Executing Submitted SQL ---");
  try {
    const res = db.exec(code);
    console.log("RESULT SUCCESS:", JSON.stringify(res, null, 2));
  } catch (err: any) {
    console.error("RESULT ERROR:", err.message);
  }
}

test();
