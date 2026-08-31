import initSqlJs from "sql.js";

async function testViews() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  db.exec(`
    CREATE TABLE Departments (
      DepartmentID INTEGER,
      DepartmentName TEXT,
      department_name TEXT
    );
    INSERT INTO Departments VALUES (1, 'Engineering', 'Engineering');
    INSERT INTO Departments VALUES (2, 'HR', 'HR');

    CREATE VIEW departments AS SELECT * FROM Departments;
  `);

  const res1 = db.exec("SELECT * FROM Departments;");
  const res2 = db.exec("SELECT * FROM departments;");

  console.log("Res1 (uppercase):", res1[0]?.values);
  console.log("Res2 (lowercase view):", res2[0]?.values);

  db.close();
}

testViews().catch(console.error);
