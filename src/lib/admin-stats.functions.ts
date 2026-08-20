import { createServerFn } from "@tanstack/react-start";
import { requireAdminSession } from "./auth.server";

export const getAdminDashboardStatsFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [employeesRes, filesRes, subsRes] = await Promise.all([
    supabaseAdmin.from("employees").select("*"),
    supabaseAdmin
      .from("employee_files")
      .select("*, employees(name, employee_id, department), submissions(id, verdict, overall_score, report)")
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("submissions").select("*, employee_files(original_name)").order("created_at", { ascending: false }),
  ]);

  if (employeesRes.error) console.error("[admin-stats] employees error:", employeesRes.error);
  if (filesRes.error) console.error("[admin-stats] files error:", filesRes.error);
  if (subsRes.error) console.error("[admin-stats] submissions error:", subsRes.error);

  const employees = employeesRes.data || [];
  const files = filesRes.data || [];
  const submissions = subsRes.data || [];

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e) => e.access_status !== false).length;

  const totalFiles = files.length;
  const fileSubMap = new Set((submissions || []).map((s: any) => s.file_id).filter(Boolean));

  // A file is validated if validation_status === 'validated', has linked submissions, or is in submissions table
  const completedValidations = files.filter(
    (f: any) =>
      f.validation_status === "validated" ||
      (Array.isArray(f.submissions) && f.submissions.length > 0) ||
      fileSubMap.has(f.id)
  ).length;
  const pendingValidations = Math.max(0, totalFiles - completedValidations);

  const totalSubmissions = submissions.length;
  let totalCorrectQuestions = 0;
  let totalWrongQuestions = 0;
  let totalScoreSum = 0;

  submissions.forEach((s: any) => {
    const verdict = s.verdict;
    const correct = s.correct_count ?? s.report?.correct_count ?? (verdict === "accepted" ? 1 : 0);
    const wrong = s.wrong_count ?? s.report?.wrong_count ?? (verdict === "rejected" ? 1 : 0);
    const score = s.overall_score ?? s.report?.scores?.overall ?? 0;

    totalCorrectQuestions += correct;
    totalWrongQuestions += wrong;
    totalScoreSum += score;
  });

  const averageScore = totalSubmissions > 0 ? Math.round(totalScoreSum / totalSubmissions) : 0;

  // Recent files (last 5)
  const recentFiles = files.slice(0, 5);

  // Recent submissions (last 5)
  const recentSubmissions = submissions.slice(0, 5);

  return {
    totalEmployees,
    activeEmployees,
    totalFiles,
    pendingValidations,
    completedValidations,
    totalSubmissions,
    totalCorrectQuestions,
    totalWrongQuestions,
    averageScore,
    recentFiles,
    recentSubmissions,
  };
});
