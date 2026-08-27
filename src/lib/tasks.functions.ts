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

export const createTaskFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createTaskSchema.parse(input))
  .handler(async ({ data }) => {
    const admin = await requireAdminSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Insert task
    const { data: task, error: taskError } = await supabaseAdmin
      .from("tasks")
      .insert([
        {
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
        },
      ])
      .select()
      .single();

    if (taskError || !task) {
      console.error("[Create Task Error]", taskError);
      throw new Error(`Failed to create task: ${taskError?.message || "Unknown error"}`);
    }

    // 2. Determine target employees
    let targetEmployees: any[] = [];
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
      // Fallback: all non-admin employees if none selected
      const { data: emps } = await supabaseAdmin
        .from("employees")
        .select("id, name, department")
        .eq("is_admin", false);
      targetEmployees = emps || [];
    }

    if (targetEmployees.length > 0) {
      // Insert task_assignments
      const assignments = targetEmployees.map((emp) => ({
        task_id: task.id,
        employee_uuid: emp.id,
        status: "Assigned",
      }));

      const { error: assignError } = await supabaseAdmin
        .from("task_assignments")
        .insert(assignments);

      if (assignError) {
        console.error("[Assign Task Error]", assignError);
      }

      // Insert in-app notifications
      const notifications = targetEmployees.map((emp) => ({
        employee_uuid: emp.id,
        task_id: task.id,
        message: `New Task Assigned: ${task.title}`,
        is_read: false,
      }));

      await supabaseAdmin.from("task_notifications").insert(notifications);
    }

    return { success: true, taskId: task.id, assignedCount: targetEmployees.length };
  });

export const listAdminTasksFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: tasks, error: tasksError } = await supabaseAdmin
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

  if (tasksError) {
    console.error("[List Admin Tasks Error]", tasksError);
    throw new Error(`Failed to list tasks: ${tasksError.message}`);
  }

  return (tasks || []).map((task) => {
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

  const { data: assignments, error } = await supabaseAdmin
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

  if (error) {
    console.error("[List Employee Tasks Error]", error);
    throw new Error("Failed to load assigned tasks");
  }

  return assignments || [];
});

export const getTaskAssignmentDetailsFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ assignmentId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const session = await requireAuthSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: assignment, error } = await supabaseAdmin
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

    if (error || !assignment) {
      throw new Error("Task assignment not found");
    }

    // Security check: Employee can only access their own assignment unless admin
    if (!session.isAdmin && assignment.employee_uuid !== session.id) {
      throw new Error("Unauthorized access to task assignment");
    }

    return assignment;
  });

export const listNotificationsFn = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireAuthSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin
    .from("task_notifications")
    .select("*, task:tasks(title)")
    .eq("employee_uuid", session.id)
    .order("created_at", { ascending: false });

  if (error) return [];
  return data || [];
});

export const markNotificationReadFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ notificationId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const session = await requireAuthSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("task_notifications")
      .update({ is_read: true })
      .eq("id", data.notificationId)
      .eq("employee_uuid", session.id);

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

    // Fetch assignment & task
    const { data: assignment, error: assignErr } = await supabaseAdmin
      .from("task_assignments")
      .select("*, task:tasks(*)")
      .eq("id", data.assignmentId)
      .single();

    if (assignErr || !assignment) {
      throw new Error("Task assignment not found");
    }

    if (!session.isAdmin && assignment.employee_uuid !== session.id) {
      throw new Error("Unauthorized");
    }

    const task = assignment.task;

    // Run strict validation pipeline using runValidationEngine
    const report = await runValidationEngine({
      code: data.code,
      language: task.language,
      question: `${task.title}\n\n${task.description}`,
      expectedOutput: task.expected_output || undefined,
      employeeName: session.name,
      employeeCode: session.employeeId,
      department: session.department,
    });

    const syntaxStatus = report.executionStatus === "error" && /syntax|error|invalid/i.test(report.execution.error || "") ? "failed" : "passed";
    const executionStatus = report.executionStatus;
    const outputMatchStatus = report.outputMatch.matched ? "matched" : task.expected_output ? "mismatch" : "not_compared";
    const verdict = report.verdict;

    // Insert task attempt
    const { data: attempt, error: attemptErr } = await supabaseAdmin
      .from("task_attempts")
      .insert([
        {
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
        },
      ])
      .select()
      .single();

    if (attemptErr) {
      console.error("[Submit Task Attempt Error]", attemptErr);
    }

    // Update assignment status
    let newStatus = assignment.status;
    let completedAt = assignment.completed_at;

    if (verdict === "accepted") {
      newStatus = "Completed";
      completedAt = new Date().toISOString();
    } else if (assignment.status === "Assigned" || assignment.status === "In Progress") {
      newStatus = "Attempted";
    }

    await supabaseAdmin
      .from("task_assignments")
      .update({
        status: newStatus,
        completed_at: completedAt,
      })
      .eq("id", assignment.id);

    return {
      success: true,
      report,
      verdict,
      newStatus,
      attempt,
    };
  });

export const submitFinalTaskAssessmentFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ assignmentId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const session = await requireAuthSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: assignment, error } = await supabaseAdmin
      .from("task_assignments")
      .select("*, attempts:task_attempts(*)")
      .eq("id", data.assignmentId)
      .single();

    if (error || !assignment) {
      throw new Error("Task assignment not found");
    }

    if (!session.isAdmin && assignment.employee_uuid !== session.id) {
      throw new Error("Unauthorized");
    }

    // Check if task has at least one accepted attempt
    const hasPassed = (assignment.attempts || []).some((att: any) => att.verdict === "accepted");

    if (!hasPassed && assignment.status !== "Completed") {
      throw new Error("Task cannot be submitted until all validation criteria are passed.");
    }

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("task_assignments")
      .update({
        status: "Submitted",
        submitted_at: now,
      })
      .eq("id", assignment.id);

    return { success: true, submittedAt: now };
  });

export const exportEmployeeListCsvFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: employees, error } = await supabaseAdmin
    .from("employees")
    .select("employee_id, name, department, is_admin, access_status, created_at")
    .order("employee_id", { ascending: true });

  if (error || !employees) {
    throw new Error("Failed to fetch employee list for export");
  }

  const headers = ["Employee ID", "Name", "Department", "Role", "Status", "Created At"];
  const rows = employees.map((emp) => [
    `"${emp.employee_id.replace(/"/g, '""')}"`,
    `"${emp.name.replace(/"/g, '""')}"`,
    `"${emp.department.replace(/"/g, '""')}"`,
    emp.is_admin ? "Admin" : "Employee",
    emp.access_status ? "Active" : "Disabled",
    `"${emp.created_at}"`,
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  return { csvContent };
});
