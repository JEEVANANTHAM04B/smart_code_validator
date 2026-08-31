import initSqlJs from "sql.js";

async function testSql() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  db.exec(`
    CREATE TABLE Employees (
      EmployeeID INTEGER,
      EmployeeName TEXT,
      employee_name TEXT,
      DepartmentID INTEGER,
      Salary INTEGER
    );
    INSERT INTO Employees VALUES (101, 'Alice', 'Alice', 1, 75000);
    INSERT INTO Employees VALUES (102, 'Bob', 'Bob', 2, 45000);
    INSERT INTO Employees VALUES (103, 'Charlie', 'Charlie', 1, 60000);
    INSERT INTO Employees VALUES (104, 'David', 'David', 3, 40000);
    INSERT INTO Employees VALUES (105, 'Emma', 'Emma', 2, 55000);
    INSERT INTO Employees VALUES (106, 'Frank', 'Frank', 1, 70000);
    INSERT INTO Employees VALUES (107, 'Grace', 'Grace', 3, 65000);

    CREATE TABLE Departments (
      DepartmentID INTEGER,
      DepartmentName TEXT,
      department_name TEXT
    );
    INSERT INTO Departments VALUES (1, 'IT', 'IT');
    INSERT INTO Departments VALUES (2, 'HR', 'HR');
    INSERT INTO Departments VALUES (3, 'Finance', 'Finance');
  `);

  const query = `
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

  const res = db.exec(query);
  console.log("Query Results:", JSON.stringify(res, null, 2));

  // Test lowercase aliases
  const query2 = `
    SELECT
        e.employee_name,
        d.department_name,
        e.salary
    FROM employees e
    JOIN departments d
        ON e.departmentid = d.departmentid
    WHERE e.salary > 60000
    ORDER BY e.salary DESC;
  `;
  const res2 = db.exec(query2);
  console.log("Query2 Results:", JSON.stringify(res2, null, 2));

  db.close();
}

testSql().catch(console.error);
