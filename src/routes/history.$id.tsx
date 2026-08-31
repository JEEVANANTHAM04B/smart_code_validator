import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { getSessionFn } from "@/lib/auth.functions";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileDown, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ValidationReportView } from "@/components/validation-report-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchSubmission } from "@/lib/submissions";
import { exportReportPdf, exportReportDocx } from "@/lib/export-report";

export const Route = createFileRoute("/history/$id")({
  beforeLoad: async () => {
    try {
      const session = await getSessionFn();
      if (!session) {
        throw redirect({ to: "/employee/login" });
      }
      return { session };
    } catch (err: any) {
      if (err?.to) throw err;
      throw redirect({ to: "/employee/login" });
    }
  },
  head: () => ({
    meta: [
      { title: "Validation Report | Smart Code Validator" },
      {
        name: "description",
        content:
          "Detailed AI validation report with scores, execution trace, complexity analysis and improved solutions.",
      },
      { property: "og:title", content: "Validation Report | Smart Code Validator" },
      {
        property: "og:description",
        content: "Detailed AI code review for a single submission.",
      },
    ],
  }),
  component: SubmissionDetailPage,
});

function SubmissionDetailPage() {
  const { id } = Route.useParams();
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["submission", id],
    queryFn: async () => {
      const row = await fetchSubmission(id);
      if (!row) throw notFound();
      return row;
    },
  });

  const handleDownload = async (kind: "pdf" | "docx") => {
    if (!data) return;
    setIsExporting(true);
    try {
      const meta = {
        employeeName: data.employee_name,
        employeeCode: data.employee_code,
        department: data.department,
        question: data.question,
        language: data.language as any,
        submittedAt: data.created_at,
        code: data.code,
      };
      if (kind === "pdf") await exportReportPdf(data.report as any, meta);
      else await exportReportDocx(data.report as any, meta);
      toast.success(`Downloaded complete report (${kind.toUpperCase()})`);
    } catch (err: any) {
      toast.error(err.message || "Failed to download report");
    } finally {
      setIsExporting(false);
    }
  };

  const questionResults = (data?.report as any)?.question_results || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link to="/history">
            <ArrowLeft className="size-4" /> Back to history
          </Link>
        </Button>

        {data && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownload("pdf")}
              disabled={isExporting}
              className="gap-1.5"
            >
              <FileDown className="size-4 text-primary" /> Download Report (PDF)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownload("docx")}
              disabled={isExporting}
              className="gap-1.5"
            >
              <FileDown className="size-4 text-primary" /> Download Report (DOCX)
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : error || !data ? (
        <p className="panel p-8 text-center text-sm text-muted-foreground">
          This submission could not be found.
        </p>
      ) : (
        <>
          <header className="panel space-y-4 p-6 border-l-4 border-l-green-600">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-green-600 hover:bg-green-700 text-white font-medium gap-1.5 px-3 py-1">
                  ✓ Validated by Admin
                </Badge>
                <Badge variant="secondary" className="font-mono uppercase">
                  {data.language}
                </Badge>
                <Badge variant="outline">{data.difficulty}</Badge>
                <Badge
                  className={
                    data.verdict === "accepted"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                      : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                  }
                >
                  {data.verdict === "accepted" ? "Accepted" : "Rejected"}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                Validated on {new Date(data.created_at).toLocaleString()}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 pb-2">
              <div className="rounded-lg bg-background p-3 border text-center">
                <div className="text-xs text-muted-foreground uppercase font-semibold">Total Marks</div>
                <div className="text-2xl font-bold text-primary mt-0.5">{data.overall_score}%</div>
              </div>
              <div className="rounded-lg bg-background p-3 border text-center">
                <div className="text-xs text-muted-foreground uppercase font-semibold">Total Questions</div>
                <div className="text-2xl font-bold mt-0.5">{data.total_questions || 1}</div>
              </div>
              <div className="rounded-lg bg-background p-3 border text-center">
                <div className="text-xs text-muted-foreground uppercase font-semibold">Correct</div>
                <div className="text-2xl font-bold text-green-600 mt-0.5">
                  {data.correct_count ?? (data.verdict === "accepted" ? 1 : 0)}
                </div>
              </div>
              <div className="rounded-lg bg-background p-3 border text-center">
                <div className="text-xs text-muted-foreground uppercase font-semibold">Wrong</div>
                <div className="text-2xl font-bold text-destructive mt-0.5">
                  {data.wrong_count ?? (data.verdict === "rejected" ? 1 : 0)}
                </div>
              </div>
            </div>

            <h1 className="text-2xl font-bold leading-snug">{data.question}</h1>
            <p className="text-sm text-muted-foreground">
              Employee: <span className="font-semibold text-foreground">{data.employee_name}</span> ({data.employee_code}) · {data.department}
            </p>

            {data.admin_notes && (
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
                <p className="text-xs uppercase font-bold tracking-wide text-primary">
                  Admin Recommendations & Notes
                </p>
                <p className="mt-1 text-sm text-foreground">{data.admin_notes}</p>
              </div>
            )}
          </header>

          {/* Question-by-Question Breakdown Card (Requirement 6) */}
          {questionResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-primary" />
                  Question-by-Question Results Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Question Prompt / Code</TableHead>
                      <TableHead>Language</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {questionResults.map((q: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono font-bold">{q.questionNumber || idx + 1}</TableCell>
                        <TableCell className="font-medium">
                          <p className="text-sm">{q.question}</p>
                        </TableCell>
                        <TableCell className="font-mono text-xs uppercase">{q.language}</TableCell>
                        <TableCell>
                          {q.verdict === "accepted" ? (
                            <div className="flex items-center gap-1 text-green-600 font-medium text-xs">
                              <CheckCircle2 className="h-4 w-4" /> Correct
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-destructive font-medium text-xs">
                              <XCircle className="h-4 w-4" /> Wrong
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold">{q.score}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <ValidationReportView
            report={data.report}
            language={data.language}
            submittedCode={data.code}
            meta={{
              employeeName: data.employee_name,
              employeeCode: data.employee_code,
              department: data.department,
              question: data.question,
              language: data.language,
              submittedAt: data.created_at,
              code: data.code,
            }}
          />
        </>
      )}
    </div>
  );
}
