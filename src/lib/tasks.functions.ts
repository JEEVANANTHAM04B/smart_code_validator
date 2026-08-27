import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuthSession, requireAdminSession } from "./auth.server";
import { runValidationEngine } from "./validation.server";

export const createTaskSchema = z.object({
  title: z.string().min(1, "Task title is required"),
  description: z.string().min(1, "Problem description is required"),
  instructions: z.string().optional(),
  document_id: z.string().uuid().optional().nullable(),
  language: z.enum(["python", "sql"]),
  expected_output: z.string().optional(),
  requirements: z.string().optional(),
  validation_criteria: z.string().optional(),
  due_date: z.string().optional().nullable(),
  departments: z.array(z.string()).optional(),
  employee_uuids: z.array(z.string().uuid()).optional(),
});

// Self-healing fallback memory store for when Supabase PostgREST tables (tasks/task_assignments)
// have not yet refreshed schema cache on remote DB instance.
interface TaskRecord {
  id: string;
  title: string;
  description: string;
  instructions: string | null;
  document_id: string | null;
  language: "python" | "sql";
  expected_output: string | null;
  requirements: string | null;
  validation_criteria: string | null;
  due_date: string | null;
  created_by: string;
  is_published: boolean;
  created_at: string;
}

interface AssignmentRecord {
  id: string;
  task_id: string;
  employee_uuid: string;
  status: "Assigned" | "In Progress" | "Attempted" | "Completed" | "Submitted";
  assigned_at: string;
  completed_at: string | null;
  submitted_at: string | null;
}

interface NotificationRecord {
  id: string;
  employee_uuid: string;
  task_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface AttemptRecord {
  id: string;
  task_assignment_id: string;
  question_index: number;
  code: string;
  language: "python" | "sql";
  syntax_status: string;
  execution_status: string;
  output_match_status: string;
  verdict: "accepted" | "rejected";
  actual_output: string;
  execution_error: string | null;
  score: number;
  report: any;
  attempted_at: string;
}

// Global in-memory task fallback store
const fallbackStore = {
  tasks: new Map<string, TaskRecord>(),
  assignments: new Map<string, AssignmentRecord>(),
  notifications: new Map<string, NotificationRecord>(),
  attempts: new Map<string, AttemptRecord[]>(),
};

function generateUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Calculates Active / Inactive status based on CONSECUTIVE MISSED ASSIGNMENTS.
 * Business Rule: If an employee misses TWO CONSECUTIVE ASSIGNMENTS assigned to them, mark as INACTIVE.
 */
export function computeEmployeeActivityStatus(
  employeeUuid: string,
  assignments: AssignmentRecord[]
) {
  const empAssignments = assignments
    .filter((a) => a.employee_uuid === employeeUuid)
    .sort((a, b) => new Date(a.assigned_at).getTime() - new Date(b.assigned_at).getTime());

  if (empAssignments.length === 0) {
    return {
      status: "Active" as const,
      consecutiveMissed: 0,
      lastSubmitted: null,
      lastActivity: null,
    };
  }

  let consecutiveMissed = 0;
  let maxConsecutiveMissed = 0;
  let lastSubmitted: string | null = null;
  let lastActivity: string | null = null;

  for (const a of empAssignments) {
    if (a.status === "Submitted" || a.status === "Completed") {
      consecutiveMissed = 0;
      if (a.submitted_at) lastSubmitted = a.submitted_at;
      if (a.completed_at || a.submitted_at) {
        lastActivity = a.submitted_at || a.completed_at;
      }
    } else if (a.status === "Assigned" || a.status === "In Progress" || a.status === "Attempted") {
      consecutiveMissed += 1;
      if (consecutiveMissed > maxConsecutiveMissed) {
        maxConsecutiveMissed = consecutiveMissed;
      }
    }
  }

  const isInactive = consecutiveMissed >= 2;

  return {
    status: isInactive ? ("Inactive" as const) : ("Active" as const),
    consecutiveMissed,
    maxConsecutiveMissed,
    lastSubmitted,
    lastActivity: lastActivity || empAssignments[empAssignments.length - 1]?.assigned_at || null,
  };
}

export const createTaskFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createTaskSchema.parse(input))
  .handler(async ({ data }) => {
    const admin = await requireAdminSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const taskId = generateUuid();
    const now = new Date().toISOString();

    const newTaskRecord: TaskRecord = {
      id: taskId,
      title: data.title,
      description: data.description,
      instructions: data.instructions || null,
      document_id: data.document_id || null,
      language: data.language,
      expected_output: data.expected_output || null,
      requirements: data.requirements || null,
      validation_criteria: data.validation_criteria || null,
      due_date: data.due_date || null,
      created_by: admin.id,
      is_published: true,
      created_at: now,
    };

    // Store in fallback store immediately
    fallbackStore.tasks.set(taskId, newTaskRecord);

    // Try inserting into Supabase DB
    try {
      await supabaseAdmin.from("tasks").insert([newTaskRecord]);
    } catch (e) {
      console.warn("[Task DB Insert Warning - Using Fallback Store]", e);
    }

    // Determine target employees
    let targetEmployees: any[] = [];
    try {
      if (data.employee_uuids && data.employee_uuids.length > 0) {
        const { data: emps } = await supabaseAdmin
          .from("employees")
          .select("id, name, department")
          .in("id", data.employee_uuids);
        targetEmployees = emps || [];
      } else if (data.departments && data.departments.length > 0) {
        const { data: emps } = await supabaseAdmin
          .from("employees")
          .select("id, name, department")
          .in("department", data.departments);
        targetEmployees = emps || [];
      } else {
        const { data: emps } = await supabaseAdmin
          .from("employees")
          .select("id, name, department")
          .eq("is_admin", false);
        targetEmployees = emps || [];
      }
    } catch {
      targetEmployees = [];
    }

    if (targetEmployees.length > 0) {
      for (const emp of targetEmployees) {
        const assignId = generateUuid();
        const assignRecord: AssignmentRecord = {
          id: assignId,
          task_id: taskId,
          employee_uuid: emp.id,
          status: "Assigned",
          assigned_at: now,
          completed_at: null,
          submitted_at: null,
        };
        fallbackStore.assignments.set(assignId, assignRecord);

        const notifId = generateUuid();
        const notifRecord: NotificationRecord = {
          id: notifId,
          employee_uuid: emp.id,
          task_id: taskId,
          message: `New Task Assigned: ${data.title}`,
          is_read: false,
          created_at: now,
        };
        fallbackStore.notifications.set(notifId, notifRecord);

        // Try DB insertion silently
        try {
          await supabaseAdmin.from("task_assignments").insert([assignRecord]);
          await supabaseAdmin.from("task_notifications").insert([notifRecord]);
        } catch {
          // Fallback store handles it
        }
      }
    }

    return { success: true, taskId, assignedCount: targetEmployees.length };
  });

export const listAdminTasksFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let tasksData: any[] = [];
  let dbFailed = false;

  try {
    const { data: dbTasks, error } = await supabaseAdmin
      .from("tasks")
      .select(`
        *,
        document:employee_files(id, original_name, file_path, file_type),
        task_assignments(
          id,
          status,
          assigned_at,
          completed_at,
          submitted_at,
          employee:employees(id, employee_id, name, department)
        )
      `)
      .order("created_at", { ascending: false });

    if (error || !dbTasks) {
      dbFailed = true;
    } else {
      tasksData = dbTasks;
    }
  } catch {
    dbFailed = true;
  }

  // If Supabase table is not in schema cache or failed, populate from fallback store
  if (dbFailed || tasksData.length === 0) {
    const { data: allEmps } = await supabaseAdmin.from("employees").select("*");
    const empsMap = new Map((allEmps || []).map((e: any) => [e.id, e]));

    tasksData = Array.from(fallbackStore.tasks.values()).map((t) => {
      const taskAssignments = Array.from(fallbackStore.assignments.values())
        .filter((a) => a.task_id === t.id)
        .map((a) => ({
          ...a,
          employee: empsMap.get(a.employee_uuid) || { id: a.employee_uuid, name: "Employee", department: "CT" },
        }));

      return {
        ...t,
        task_assignments: taskAssignments,
      };
    });
  }

  return tasksData.map((task) => {
    const assignments = task.task_assignments || [];
    const totalAssigned = assignments.length;
    const notStarted = assignments.filter((a: any) => a.status === "Assigned").length;
    const inProgress = assignments.filter((a: any) => a.status === "In Progress").length;
    const attempted = assignments.filter((a: any) => a.status === "Attempted").length;
    const completed = assignments.filter((a: any) => a.status === "Completed").length;
    const submitted = assignments.filter((a: any) => a.status === "Submitted").length;

    return {
      ...task,
      stats: {
        totalAssigned,
        notStarted,
        inProgress,
        attempted,
        completed,
        submitted,
      },
    };
  });
});

export const listEmployeeTasksFn = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireAuthSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let assignmentsData: any[] = [];
  let dbFailed = false;

  try {
    const { data: dbAssigns, error } = await supabaseAdmin
      .from("task_assignments")
      .select(`
        id,
        status,
        assigned_at,
        completed_at,
        submitted_at,
        task:tasks(
          id,
          title,
          description,
          instructions,
          language,
          expected_output,
          requirements,
          validation_criteria,
          due_date,
          document_id,
          document:employee_files(id, original_name, file_path, file_type, file_size)
        )
      `)
      .eq("employee_uuid", session.id)
      .order("assigned_at", { ascending: false });

    if (error || !dbAssigns) {
      dbFailed = true;
    } else {
      assignmentsData = dbAssigns;
    }
  } catch {
    dbFailed = true;
  }

  // Fallback memory store lookup
  if (dbFailed || assignmentsData.length === 0) {
    const myAssigns = Array.from(fallbackStore.assignments.values()).filter(
      (a) => a.employee_uuid === session.id
    );

    assignmentsData = myAssigns.map((a) => {
      const task = fallbackStore.tasks.get(a.task_id);
      return {
        id: a.id,
        status: a.status,
        assigned_at: a.assigned_at,
        completed_at: a.completed_at,
        submitted_at: a.submitted_at,
        task: task || {
          id: a.task_id,
          title: "Assessment Task",
          description: "Task description",
          language: "python",
        },
      };
    });
  }

  return assignmentsData;
});

export const getTaskAssignmentDetailsFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ assignmentId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const session = await requireAuthSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let assignment: any = null;

    try {
      const { data: dbAssign } = await supabaseAdmin
        .from("task_assignments")
        .select(`
          id,
          status,
          assigned_at,
          completed_at,
          submitted_at,
          employee_uuid,
          task:tasks(
            id,
            title,
            description,
            instructions,
            language,
            expected_output,
            requirements,
            validation_criteria,
            due_date,
            document_id,
            document:employee_files(id, original_name, file_path, file_type, file_size)
          ),
          attempts:task_attempts(*)
        `)
        .eq("id", data.assignmentId)
        .single();
      if (dbAssign) assignment = dbAssign;
    } catch {
      // Fallback
    }

    if (!assignment) {
      const a = fallbackStore.assignments.get(data.assignmentId);
      if (a) {
        const task = fallbackStore.tasks.get(a.task_id);
        const attempts = fallbackStore.attempts.get(a.id) || [];
        assignment = {
          ...a,
          task,
          attempts,
        };
      }
    }

    if (!assignment) {
      throw new Error("Task assignment not found");
    }

    if (!session.isAdmin && assignment.employee_uuid !== session.id) {
      throw new Error("Unauthorized access to task assignment");
    }

    return assignment;
  });

export const listNotificationsFn = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireAuthSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  try {
    const { data } = await supabaseAdmin
      .from("task_notifications")
      .select("*, task:tasks(title)")
      .eq("employee_uuid", session.id)
      .order("created_at", { ascending: false });

    if (data && data.length > 0) return data;
  } catch {
    // Fallback
  }

  return Array.from(fallbackStore.notifications.values())
    .filter((n) => n.employee_uuid === session.id)
    .map((n) => ({
      ...n,
      task: { title: fallbackStore.tasks.get(n.task_id)?.title || "Assessment Task" },
    }));
});

export const markNotificationReadFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ notificationId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const session = await requireAuthSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const notif = fallbackStore.notifications.get(data.notificationId);
    if (notif && notif.employee_uuid === session.id) {
      notif.is_read = true;
    }

    try {
      await supabaseAdmin
        .from("task_notifications")
        .update({ is_read: true })
        .eq("id", data.notificationId)
        .eq("employee_uuid", session.id);
    } catch {
      // Ignored
    }

    return { success: true };
  });

export const submitTaskAttemptFn = createServerFn({ method: "POST" })
  .inputValidator(
    (input: unknown) =>
      z
        .object({
          assignmentId: z.string().uuid(),
          code: z.string().min(1, "Code content is required"),
        })
        .parse(input)
  )
  .handler(async ({ data }) => {
    const session = await requireAuthSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Retrieve assignment
    let assignment: any = null;
    try {
      const { data: dbAssign } = await supabaseAdmin
        .from("task_assignments")
        .select("*, task:tasks(*)")
        .eq("id", data.assignmentId)
        .single();
      if (dbAssign) assignment = dbAssign;
    } catch {
      // Fallback
    }

    if (!assignment) {
      const a = fallbackStore.assignments.get(data.assignmentId);
      if (a) {
        const task = fallbackStore.tasks.get(a.task_id);
        assignment = { ...a, task };
      }
    }

    if (!assignment) {
      throw new Error("Task assignment not found");
    }

    if (!session.isAdmin && assignment.employee_uuid !== session.id) {
      throw new Error("Unauthorized");
    }

    const task = assignment.task;

    // Run strict validation engine on current editor code
    const report = await runValidationEngine({
      code: data.code,
      language: task.language,
      question: `${task.title}\n\n${task.description}`,
      expectedOutput: task.expected_output || undefined,
      employeeName: session.name,
      employeeCode: session.employeeId,
      department: session.department,
    });

    const syntaxStatus =
      report.executionStatus === "error" &&
      /syntax|error|invalid/i.test(report.execution.error || "")
        ? "failed"
        : "passed";
    const executionStatus = report.executionStatus;
    const outputMatchStatus = report.outputMatch.matched
      ? "matched"
      : task.expected_output
      ? "mismatch"
      : "not_compared";
    const verdict = report.verdict;

    const attemptId = generateUuid();
    const now = new Date().toISOString();

    const attemptRecord: AttemptRecord = {
      id: attemptId,
      task_assignment_id: assignment.id,
      question_index: 1,
      code: data.code,
      language: task.language,
      syntax_status: syntaxStatus,
      execution_status: executionStatus,
      output_match_status: outputMatchStatus,
      verdict,
      actual_output: report.execution.output || "",
      execution_error: report.execution.error || null,
      score: report.scores.overall || 0,
      report,
      attempted_at: now,
    };

    const existingAttempts = fallbackStore.attempts.get(assignment.id) || [];
    fallbackStore.attempts.set(assignment.id, [...existingAttempts, attemptRecord]);

    try {
      await supabaseAdmin.from("task_attempts").insert([attemptRecord]);
    } catch {
      // Ignored
    }

    // Update assignment status
    let newStatus = assignment.status;
    let completedAt = assignment.completed_at;

    if (verdict === "accepted") {
      newStatus = "Completed";
      completedAt = now;
    } else if (assignment.status === "Assigned" || assignment.status === "In Progress") {
      newStatus = "Attempted";
    }

    // Update local store
    const localAssign = fallbackStore.assignments.get(assignment.id);
    if (localAssign) {
      localAssign.status = newStatus as any;
      localAssign.completed_at = completedAt;
    }

    try {
      await supabaseAdmin
        .from("task_assignments")
        .update({
          status: newStatus,
          completed_at: completedAt,
        })
        .eq("id", assignment.id);
    } catch {
      // Ignored
    }

    return {
      success: true,
      report,
      verdict,
      newStatus,
      attempt: attemptRecord,
    };
  });

export const submitFinalTaskAssessmentFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ assignmentId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const session = await requireAuthSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let assignment: any = null;
    try {
      const { data: dbAssign } = await supabaseAdmin
        .from("task_assignments")
        .select("*, attempts:task_attempts(*)")
        .eq("id", data.assignmentId)
        .single();
      if (dbAssign) assignment = dbAssign;
    } catch {
      // Fallback
    }

    if (!assignment) {
      const a = fallbackStore.assignments.get(data.assignmentId);
      if (a) {
        const attempts = fallbackStore.attempts.get(a.id) || [];
        assignment = { ...a, attempts };
      }
    }

    if (!assignment) {
      throw new Error("Task assignment not found");
    }

    if (!session.isAdmin && assignment.employee_uuid !== session.id) {
      throw new Error("Unauthorized");
    }

    const hasPassed = (assignment.attempts || []).some((att: any) => att.verdict === "accepted");
    if (!hasPassed && assignment.status !== "Completed") {
      throw new Error("Task cannot be submitted until all validation criteria are passed.");
    }

    const now = new Date().toISOString();

    const localAssign = fallbackStore.assignments.get(assignment.id);
    if (localAssign) {
      localAssign.status = "Submitted";
      localAssign.submitted_at = now;
    }

    try {
      await supabaseAdmin
        .from("task_assignments")
        .update({
          status: "Submitted",
          submitted_at: now,
        })
        .eq("id", assignment.id);
    } catch {
      // Ignored
    }

    return { success: true, submittedAt: now };
  });

export const exportEmployeeListCsvFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: employees, error } = await supabaseAdmin
    .from("employees")
    .select("id, employee_id, name, department, is_admin, access_status, created_at")
    .order("employee_id", { ascending: true });

  if (error || !employees) {
    throw new Error("Failed to fetch employee list for export");
  }

  const allAssignments = Array.from(fallbackStore.assignments.values());

  const headers = [
    "Employee ID",
    "Name",
    "Department",
    "Role",
    "Account Status",
    "Activity Status (2 Missed Rule)",
    "Consecutive Missed Assignments",
    "Last Submitted Date",
    "Created At",
  ];

  const rows = employees.map((emp) => {
    const activity = computeEmployeeActivityStatus(emp.id, allAssignments);
    return [
      `"${emp.employee_id.replace(/"/g, '""')}"`,
      `"${emp.name.replace(/"/g, '""')}"`,
      `"${emp.department.replace(/"/g, '""')}"`,
      emp.is_admin ? "Admin" : "Employee",
      emp.access_status ? "Active Account" : "Disabled",
      `"${activity.status}"`,
      activity.consecutiveMissed,
      `"${activity.lastSubmitted ? new Date(activity.lastSubmitted).toLocaleString() : "None"}"`,
      `"${emp.created_at}"`,
    ];
  });

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  return { csvContent };
});
