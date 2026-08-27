const question = `
Employees:

EmployeeID | EmployeeName | DepartmentID | Salary
101 | Alice | 1 | 75000
102 | Bob | 2 | 45000
103 | Charlie | 1 | 60000

Departments:

DepartmentID | DepartmentName
1 | IT
2 | HR
`;

const lines = question.split("\n");
console.log("Total lines:", lines.length);

for (const line of lines) {
  const l = line.trim();
  if (!l) continue;
  const isPipeTable = l.includes("|");
  const isDashTable = /^[-=:\s|]+$/.test(l) && l.includes("-");
  console.log({ line: l, isPipeTable, isDashTable });
}
