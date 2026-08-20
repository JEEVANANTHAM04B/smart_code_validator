import { createServerFn } from "@tanstack/react-start";
import { requireAuthSession } from "./auth.server";

export const getEmployeeStatsFn = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireAuthSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [filesRes, subsRes] = await Promise.all([
    supabaseAdmin
      .from("employee_files")
      .select("*, submissions(id, verdict, overall_score)")
      .eq("employee_uuid", session.id)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("submissions")
      .select("*")
      .eq("employee_uuid", session.id)
      .eq("is_published", true)
      .order("created_at", { ascending: false }),
  ]);

  const files = filesRes.data || [];
  const submissions = subsRes.data || [];

  const totalFiles = files.length;
  const completedValidations = files.filter(
    (f: any) => f.validation_status === "validated" || (Array.isArray(f.submissions) && f.submissions.length > 0)
  ).length;
  const pendingValidations = Math.max(0, totalFiles - completedValidations);

  let totalQuestions = 0;
  let correctQuestions = 0;
  let wrongQuestions = 0;
  let totalScoreSum = 0;

  submissions.forEach((s: any) => {
    const qCount = s.total_questions ?? 1;
    const cCount = s.correct_count ?? (s.verdict === "accepted" ? 1 : 0);
    const wCount = s.wrong_count ?? (s.verdict === "rejected" ? 1 : 0);

    totalQuestions += qCount;
    correctQuestions += cCount;
    wrongQuestions += wCount;
    totalScoreSum += s.overall_score || 0;
  });

  const averageScore = submissions.length > 0 ? Math.round(totalScoreSum / submissions.length) : 0;

  return {
    employeeName: session.name,
    employeeId: session.employeeId,
    department: session.department,
    totalFiles,
    pendingValidations,
    completedValidations,
    totalSubmissions: submissions.length,
    totalQuestions,
    correctQuestions,
    wrongQuestions,
    averageScore,
    recentFiles: files.slice(0, 5),
    recentSubmissions: submissions.slice(0, 5),
  };
});
