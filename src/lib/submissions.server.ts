import { z } from "zod";

import type { ValidationReport } from "@/lib/validation-types";
import { DEPARTMENTS } from "@/lib/validation-types";
import { validationInputSchema } from "@/lib/validation-schema";

export const submissionInsertSchema = validationInputSchema
  .extend({
    department: z.enum(DEPARTMENTS),
    report: z.record(z.string(), z.unknown()),
  })
  .strict();

export type SubmissionInsertPayload = z.infer<typeof submissionInsertSchema>;

export const submissionIdSchema = z.object({ id: z.string().uuid() });

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function listSubmissions() {
  const supabase = await admin();
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error("[submissions] list failed", error);
    throw new Error("Unable to load submissions");
  }
  return data ?? [];
}

export async function getSubmission(id: string) {
  const supabase = await admin();
  const { data, error } = await supabase.from("submissions").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("[submissions] get failed", error);
    throw new Error("Unable to load submission");
  }
  return data ?? null;
}

export async function createSubmission(payload: any) {
  const supabase = await admin();
  const rawReport = payload.report as unknown as ValidationReport;
  const isPublished = payload.is_published ?? true; // Defaults to true when created directly by Admin
  const verdict = rawReport.verdict;
  const correctCount = payload.correct_count ?? (verdict === "accepted" ? 1 : 0);
  const wrongCount = payload.wrong_count ?? (verdict === "rejected" ? 1 : 0);
  const totalQuestions = payload.total_questions ?? 1;

  // Resolve employee_uuid if missing
  let resolvedEmployeeUuid = payload.employee_uuid || null;

  if (!resolvedEmployeeUuid && payload.file_id) {
    try {
      const { data: fileRec } = await supabase
        .from("employee_files")
        .select("employee_uuid")
        .eq("id", payload.file_id)
        .maybeSingle();
      if (fileRec?.employee_uuid) {
        resolvedEmployeeUuid = fileRec.employee_uuid;
      }
    } catch (e) {
      console.warn("[submissions] Could not fetch employee_uuid from employee_files:", e);
    }
  }

  if (!resolvedEmployeeUuid && payload.employeeCode) {
    try {
      const { data: empRec } = await supabase
        .from("employees")
        .select("id")
        .eq("employee_id", payload.employeeCode)
        .maybeSingle();
      if (empRec?.id) {
        resolvedEmployeeUuid = empRec.id;
      }
    } catch (e) {
      console.warn("[submissions] Could not fetch employee_uuid from employees:", e);
    }
  }

  // Embed workflow fields in JSONB report payload so UI components can access them
  const report = {
    ...rawReport,
    is_published: isPublished,
    total_questions: totalQuestions,
    correct_count: correctCount,
    wrong_count: wrongCount,
    admin_notes: payload.admin_notes ?? payload.reviewer_notes ?? null,
  };

  // Core payload containing ONLY base schema columns guaranteed to exist in PostgREST cache
  const baseRecordPayload: Record<string, unknown> = {
    employee_name: payload.employeeName,
    employee_code: payload.employeeCode,
    department: payload.department,
    language: payload.language,
    question: payload.question,
    expected_output: payload.expectedOutput ?? null,
    code: payload.code,
    verdict: verdict,
    overall_score: report.scores.overall,
    logic_score: report.scores.logic,
    syntax_score: report.scores.syntax,
    quality_score: report.scores.quality,
    efficiency_score: report.scores.efficiency,
    best_practices_score: report.scores.bestPractices,
    output_match_score: report.scores.outputMatch,
    readability_score: report.scores.readability,
    difficulty: report.difficulty.level,
    difficulty_score: report.difficulty.score,
    time_complexity: report.complexity.time,
    space_complexity: report.complexity.space,
    execution_time_ms: report.execution.estimatedTimeMs,
    problem_type: report.problemType,
    execution_output: report.execution.output,
    execution_error: report.execution.error,
    execution_status: report.executionStatus,
    output_matched: report.outputMatch.matched,
    output_match_reason: report.outputMatch.reason,
    report: JSON.parse(JSON.stringify(report)),
    employee_uuid: resolvedEmployeeUuid,
    file_id: payload.file_id ?? null,
    reviewer_notes: payload.admin_notes ?? payload.reviewer_notes ?? null,
  };

  let submissionId = "";

  // Check if a submission already exists for this file_id to update it instead of creating duplicates
  if (payload.file_id) {
    try {
      const { data: existing } = await supabase
        .from("submissions")
        .select("id")
        .eq("file_id", payload.file_id)
        .maybeSingle();
      if (existing?.id) {
        submissionId = existing.id;
        const { error: updateErr } = await supabase
          .from("submissions")
          .update(baseRecordPayload as any)
          .eq("id", existing.id);
        if (updateErr) {
          console.warn("[submissions] Base update warning:", updateErr.message);
        }
      }
    } catch (e) {
      console.warn("[submissions] could not check existing submission for file_id:", e);
    }
  }

  if (!submissionId) {
    const { data, error } = await supabase
      .from("submissions")
      .insert(baseRecordPayload as any)
      .select("id")
      .single();

    if (error) {
      console.error("[submissions] insert failed", error);
      throw new Error(`Unable to save submission: ${error.message}`);
    }
    submissionId = data.id;
  }

  // Soft-update optional workflow columns if present in database schema
  try {
    await supabase
      .from("submissions")
      .update({
        is_published: isPublished,
        total_questions: totalQuestions,
        correct_count: correctCount,
        wrong_count: wrongCount,
        admin_notes: payload.admin_notes ?? payload.reviewer_notes ?? null,
      } as any)
      .eq("id", submissionId);
  } catch (e) {
    // Ignore schema mismatch warnings for optional columns
    console.info("[submissions] optional workflow columns update skipped (using JSONB report payload)");
  }

  // If a file_id is linked and is_published is true, mark the file as validated
  if (payload.file_id && isPublished) {
    try {
      await supabase
        .from("employee_files")
        .update({ validation_status: "validated" } as any)
        .eq("id", payload.file_id);
    } catch (e) {
      console.warn("Could not update file validation_status column:", e);
    }
  }

  return { id: submissionId };
}

export async function publishSubmission(id: string, adminNotes?: string) {
  const supabase = await admin();

  const { data: sub, error: fetchErr } = await supabase
    .from("submissions")
    .select("file_id, report")
    .eq("id", id)
    .single();

  if (fetchErr || !sub) throw new Error("Submission not found");

  const existingReport = (sub.report as any) || {};
  const updatedReport = {
    ...existingReport,
    is_published: true,
    admin_notes: adminNotes ?? existingReport.admin_notes ?? null,
  };

  const { error } = await supabase
    .from("submissions")
    .update({
      reviewer_notes: adminNotes ?? null,
      report: JSON.parse(JSON.stringify(updatedReport)),
    } as any)
    .eq("id", id);

  if (error) {
    console.error("[submissions] publish failed", error);
    throw new Error(`Failed to publish validation: ${error.message}`);
  }

  // Soft-update optional workflow columns if present
  try {
    await supabase
      .from("submissions")
      .update({
        is_published: true,
        admin_notes: adminNotes ?? null,
      } as any)
      .eq("id", id);
  } catch (e) {
    // Ignore schema mismatch for optional columns
  }

  if (sub?.file_id) {
    try {
      await supabase
        .from("employee_files")
        .update({ validation_status: "validated" } as any)
        .eq("id", sub.file_id);
    } catch (e) {
      console.warn("Could not update file validation_status column:", e);
    }
  }

  return { success: true };
}

