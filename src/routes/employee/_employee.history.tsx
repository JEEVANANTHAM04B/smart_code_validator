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
import { listMySubmissionsFn } from "@/lib/submissions.functions";
import { listMyFilesFn } from "@/lib/files.functions";
import { toast } from "sonner";
import { format } from "date-fns";
import { scoreTone } from "@/lib/validation-types";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, FileText, Clock, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/employee/_employee/history")({
  component: EmployeeHistory,
});

function EmployeeHistory() {
  const listMySubmissions = useServerFn(listMySubmissionsFn);
  const listMyFiles = useServerFn(listMyFilesFn);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [files, subs] = await Promise.all([listMyFiles(), listMySubmissions()]);
        
        // Map files to history rows, matching with published submissions if present
        const subMap = new Map((subs || []).map((s: any) => [s.file_id || s.id, s]));

        const combined: any[] = [];
        const processedSubIds = new Set<string>();

        (files || []).forEach((file: any) => {
          let matchingSub = subMap.get(file.id);
          if (!matchingSub && Array.isArray(file.submissions) && file.submissions.length > 0) {
            matchingSub =
              file.submissions.find((s: any) => s.is_published === true || s.report?.is_published !== false) ||
              file.submissions[0];
          }
          if (matchingSub) {
            processedSubIds.add(matchingSub.id);
          }
          combined.push({
            id: file.id,
            fileName: file.original_name,
            uploadDate: file.created_at,
            fileType: file.file_type,
            fileStatus: file.validation_status,
            submission: matchingSub || null,
          });
        });

        // Add any standalone submissions not linked to a file
        (subs || []).forEach((sub: any) => {
          if (!processedSubIds.has(sub.id)) {
            combined.push({
              id: sub.id,
              fileName: sub.employee_files?.original_name || "Direct Assessment",
              uploadDate: sub.created_at,
              fileType: sub.language,
              fileStatus: "validated",
              submission: sub,
            });
          }
        });

        setHistoryItems(combined);
      } catch (err: any) {
        toast.error("Failed to load history");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">My Assessment History</h2>
        <p className="text-sm text-muted-foreground">
          Track uploaded assessments and view results published by Admin
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Upload Date</TableHead>
                <TableHead>Validation Status</TableHead>
                <TableHead>Submission Status</TableHead>
                <TableHead className="text-center">Total Questions</TableHead>
                <TableHead className="text-center">Correct</TableHead>
                <TableHead className="text-center">Wrong</TableHead>
                <TableHead>Marks</TableHead>
                <TableHead className="text-right">View Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-6">
                    Loading history...
                  </TableCell>
                </TableRow>
              ) : historyItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                    No uploaded files or submissions found.
                  </TableCell>
                </TableRow>
              ) : (
                historyItems.map((item) => {
                  const sub = item.submission;
                  const isValidated = item.fileStatus === "validated" || (!!sub && sub.is_published !== false);
                  const verdict = sub?.verdict;
                  const score = sub?.overall_score ?? sub?.report?.scores?.overall;
                  const totalQs = sub
                    ? sub.total_questions ?? sub.report?.total_questions ?? sub.report?.question_results?.length ?? 1
                    : null;
                  const correct = sub
                    ? sub.correct_count ?? sub.report?.correct_count ?? (verdict === "accepted" ? 1 : 0)
                    : null;
                  const wrong = sub
                    ? sub.wrong_count ?? sub.report?.wrong_count ?? (verdict === "rejected" ? 1 : 0)
                    : null;

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[180px]" title={item.fileName}>
                            {item.fileName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(item.uploadDate), "MMM d, yyyy h:mm a")}
                      </TableCell>
                      <TableCell>
                        {isValidated ? (
                          <div className="flex items-center gap-1.5 text-green-600 font-medium text-xs">
                            <CheckCircle2 className="h-4 w-4" />
                            Validated by Admin
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-amber-600 font-medium text-xs">
                            <Clock className="h-4 w-4" />
                            Pending Admin Validation
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {isValidated ? (
                          verdict === "accepted" ? (
                            <Badge className="bg-green-600 hover:bg-green-700 text-white text-xs">
                              Accepted
                            </Badge>
                          ) : verdict === "rejected" ? (
                            <Badge variant="destructive" className="text-xs">
                              Rejected
                            </Badge>
                          ) : (
                            <Badge className="bg-blue-600 text-white text-xs">
                              Submitted
                            </Badge>
                          )
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-xs">
                            In Review
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {isValidated && totalQs !== null ? (
                          <span className="font-mono text-xs">{totalQs}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {isValidated && correct !== null ? (
                          <span className="text-green-600 font-mono text-xs">{correct}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {isValidated && wrong !== null ? (
                          <span className="text-destructive font-mono text-xs">{wrong}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isValidated && score !== undefined && score !== null ? (
                          <Badge
                            variant={
                              scoreTone(score) === "success"
                                ? "default"
                                : scoreTone(score) === "warning"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {score}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isValidated && sub?.id ? (
                          <Button variant="outline" size="sm" asChild className="gap-1.5">
                            <Link to="/history/$id" params={{ id: sub.id }}>
                              <Eye className="h-3.5 w-3.5" />
                              View Result
                            </Link>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Waiting for Admin</span>
                        )}
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

