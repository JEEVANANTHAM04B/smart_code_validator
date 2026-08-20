import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listSubmissionsFn } from "@/lib/submissions.functions";
import { toast } from "sonner";
import { format } from "date-fns";
import { scoreTone } from "@/lib/validation-types";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, FileText, Eye, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportReportPdf } from "@/lib/export-report";

export const Route = createFileRoute("/admin/_admin/submissions")({
  component: AdminSubmissions,
});

function AdminSubmissions() {
  const listSubmissions = useServerFn(listSubmissionsFn);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await listSubmissions();
        setSubmissions(data || []);
      } catch (err: any) {
        toast.error(err.message || "Failed to load submissions");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleDownloadReport = async (sub: any) => {
    try {
      const meta = {
        employeeName: sub.employee_name,
        employeeCode: sub.employee_code,
        department: sub.department,
        question: sub.question,
        language: sub.language as any,
        submittedAt: sub.created_at,
        code: sub.code,
      };
      await exportReportPdf(sub.report, meta);
      toast.success(`Downloaded report for ${sub.employee_name}`);
    } catch (err: any) {
      toast.error("Failed to download report");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Validated Submissions & Reports</h2>
        <p className="text-sm text-muted-foreground">
          View all completed validations, question breakdowns, scores, and download PDF/DOCX reports
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>File / Question</TableHead>
                <TableHead className="text-center">Questions</TableHead>
                <TableHead className="text-center">Correct</TableHead>
                <TableHead className="text-center">Wrong</TableHead>
                <TableHead>Marks</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-6">
                    Loading submissions...
                  </TableCell>
                </TableRow>
              ) : submissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                    No submissions found.
                  </TableCell>
                </TableRow>
              ) : (
                submissions.map((sub) => {
                  const total = sub.total_questions || 1;
                  const correct = sub.correct_count ?? (sub.verdict === "accepted" ? 1 : 0);
                  const wrong = sub.wrong_count ?? (sub.verdict === "rejected" ? 1 : 0);

                  return (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <div className="font-medium">{sub.employee_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {sub.employee_code} ({sub.department})
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate" title={sub.question}>
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{sub.question}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-center font-mono text-xs">{total}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-green-600 font-semibold font-mono text-xs">{correct}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-destructive font-semibold font-mono text-xs">{wrong}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            scoreTone(sub.overall_score) === "success"
                              ? "default"
                              : scoreTone(sub.overall_score) === "warning"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {sub.overall_score}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {sub.is_published ? (
                          <Badge className="bg-green-600 hover:bg-green-700 text-white text-xs">
                            Published
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-500 text-xs">
                            Draft / Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(sub.created_at), "MMM d, yyyy h:mm a")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadReport(sub)}
                            className="gap-1 text-xs"
                            title="Download Report"
                          >
                            <FileDown className="h-3.5 w-3.5 text-primary" />
                            Report
                          </Button>
                          <Button variant="ghost" size="sm" asChild className="gap-1">
                            <Link to="/history/$id" params={{ id: sub.id }}>
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
