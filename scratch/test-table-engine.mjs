import initSqlJs from "sql.js";

const DEFAULT_SEEDS = {
  employees: {
    name: "Employees",
    cols: ["EmployeeID INTEGER", "EmployeeName TEXT", "employee_name TEXT", "DepartmentID INTEGER", "Salary INTEGER"],
    rows: [
      [101, 'Alice', 'Alice', 1, 75000],
      [102, 'Bob', 'Bob', 2, 45000],
      [103, 'Charlie', 'Charlie', 1, 60000],
      [104, 'David', 'David', 3, 40000],
      [105, 'Emma', 'Emma', 2, 55000],
      [106, 'Frank', 'Frank', 1, 70000],
      [107, 'Grace', 'Grace', 3, 65000],
    ],
  },
  departments: {
    name: "Departments",
    cols: ["DepartmentID INTEGER", "DepartmentName TEXT", "department_name TEXT"],
    rows: [
      [1, 'IT', 'IT'],
      [2, 'HR', 'HR'],
      [3, 'Finance', 'Finance'],
    ],
  },
  products: {
    name: "Products",
    cols: ["ProductID INTEGER", "ProductName TEXT", "product_name TEXT", "CategoryID INTEGER", "Price INTEGER"],
    rows: [
      [1, 'Laptop', 'Laptop', 1, 1200],
      [2, 'Phone', 'Phone', 2, 800],
      [3, 'Tablet', 'Tablet', 2, 500],
      [4, 'Monitor', 'Monitor', 1, 300],
      [5, 'Keyboard', 'Keyboard', 1, 100],
    ],
  },
  categories: {
    name: "Categories",
    cols: ["CategoryID INTEGER", "CategoryName TEXT", "category_name TEXT"],
    rows: [
      [1, 'Electronics', 'Electronics'],
      [2, 'Accessories', 'Accessories'],
    ],
  },
};

async function runTest() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  for (const seedKey of Object.keys(DEFAULT_SEEDS)) {
    const seed = DEFAULT_SEEDS[seedKey];
    db.exec(`CREATE TABLE IF NOT EXISTS "${seed.name}" (${seed.cols.join(", ")});`);
    const placeholders = seed.cols.map(() => "?").join(", ");
    for (const r of seed.rows) {
      db.run(`INSERT INTO "${seed.name}" VALUES (${placeholders});`, r);
    }
  }

  // Test 1: SELECT e.EmployeeName, d.DepartmentName FROM Employees e JOIN Departments d ON e.DepartmentID = d.DepartmentID
  const q1 = `
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

  const res1 = db.exec(q1);
  console.log("Test 1 Result:", JSON.stringify(res1[0]?.values));

  // Test 2: SELECT p.ProductName, c.CategoryName FROM Products p JOIN Categories c ON p.CategoryID = c.CategoryID
  const q2 = `
    SELECT p.ProductName, c.CategoryName
    FROM Products p
    JOIN Categories c ON p.CategoryID = c.CategoryID
    WHERE p.Price >= 500;
  `;
  const res2 = db.exec(q2);
  console.log("Test 2 Result:", JSON.stringify(res2[0]?.values));

  db.close();
}

runTest().catch(console.error);
