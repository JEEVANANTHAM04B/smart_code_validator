import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listEmployeeTasksFn,
  getTaskAssignmentDetailsFn,
  submitTaskAttemptFn,
  submitFinalTaskAssessmentFn,
} from "@/lib/tasks.functions";
import { fetchFileContentFn } from "@/lib/files.functions";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Play,
  Upload,
  FileText,
  Clock,
  Send,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/employee/_employee/tasks")({
  component: EmployeeTasksPage,
});

function EmployeeTasksPage() {
  const router = useRouter();
  const listEmployeeTasks = useServerFn(listEmployeeTasksFn);
  const getTaskAssignmentDetails = useServerFn(getTaskAssignmentDetailsFn);
  const submitTaskAttempt = useServerFn(submitTaskAttemptFn);
  const submitFinalTaskAssessment = useServerFn(submitFinalTaskAssessmentFn);
  const fetchFileContent = useServerFn(fetchFileContentFn);

  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Task Workspace State
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [editorCode, setEditorCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmittingFinal, setIsSubmittingFinal] = useState(false);
  const [latestReport, setLatestReport] = useState<any | null>(null);
  const [docContent, setDocContent] = useState<string | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await listEmployeeTasks();
      setAssignments(data || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load assigned tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenWorkspace = (assignmentId: string) => {
    router.navigate({ to: "/validator", search: { assignmentId } });
  };

  // Upload source file (.py / .sql) and load file text into Code Editor
  const handleFileUploadToEditor = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error("Source file exceeds maximum 50 MB limit.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text !== undefined) {
        setEditorCode(text);
        toast.success(`Loaded ${file.name} into Code Editor`);
      }
    };
    reader.onerror = () => toast.error("Failed to read uploaded source file");
    reader.readAsText(file);
  };

  const handleValidateCode = async () => {
    if (!editorCode.trim()) {
      toast.error("Please enter or upload code before validating");
      return;
    }
    if (!selectedAssignment) return;

    setIsValidating(true);
    try {
      const res = await submitTaskAttempt({
        data: {
          assignmentId: selectedAssignment.id,
          code: editorCode,
        },
      });

      setLatestReport(res.report);
      if (res.verdict === "accepted") {
        toast.success("Validation PASSED! Task marked as Completed.");
      } else {
        toast.error("Validation failed. Please review errors and try again.");
      }

      // Refresh assignment details
      const updated = await getTaskAssignmentDetails({
        data: { assignmentId: selectedAssignment.id },
      });
      setSelectedAssignment(updated);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Validation failed");
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmitFinal = async () => {
    if (!selectedAssignment) return;
    setIsSubmittingFinal(true);
    try {
      await submitFinalTaskAssessment({ data: { assignmentId: selectedAssignment.id } });
      toast.success("Assessment submitted successfully to Admin!");
      setIsWorkspaceOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Final submission failed");
    } finally {
      setIsSubmittingFinal(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Assigned Tasks & Assessments</h2>
        <p className="text-sm text-muted-foreground">
          View assigned tasks, upload or write solutions, and run automated validation
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <Card className="col-span-full">
            <CardContent className="p-8 text-center text-muted-foreground">
              Loading assigned tasks...
            </CardContent>
          </Card>
        ) : assignments.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="p-8 text-center text-muted-foreground">
              No tasks assigned yet. Check back when your manager publishes new tasks.
            </CardContent>
          </Card>
        ) : (
          assignments.map((item) => {
            const task = item.task;
            const status = item.status;
            return (
              <Card key={item.id} className="flex flex-col justify-between border-primary/20 hover:border-primary/50 transition-colors">
                <CardHeader className="space-y-2">
                  <div className="flex justify-between items-start">
                    <Badge variant="outline" className="uppercase font-mono text-[10px]">
                      {task.language}
                    </Badge>
                    <Badge
                      className={
                        status === "Submitted"
                          ? "bg-emerald-500/15 text-emerald-600"
                          : status === "Completed"
                          ? "bg-green-500/15 text-green-600"
                          : status === "Attempted"
                          ? "bg-yellow-500/15 text-yellow-600"
                          : status === "In Progress"
                          ? "bg-blue-500/15 text-blue-600"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {status}
                    </Badge>
                  </div>
                  <CardTitle className="text-base">{task.title}</CardTitle>
                  <CardDescription className="line-clamp-2 text-xs">
                    {task.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Assigned:{" "}
                      {new Date(item.assigned_at).toLocaleDateString()}
                    </span>
                    {task.due_date && (
                      <span className="text-destructive font-medium">
                        Due: {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <Button
                    onClick={() => handleOpenWorkspace(item.id)}
                    className="w-full gap-2"
                    variant={status === "Completed" || status === "Submitted" ? "outline" : "default"}
                  >
                    <FileText className="w-4 h-4" />
                    {status === "Submitted"
                      ? "View Submitted Task"
                      : status === "Completed"
                      ? "View Completed Task"
                      : "Open Task Workspace"}
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Task Workspace & Code Validation Modal */}
      {selectedAssignment && (
        <Dialog open={isWorkspaceOpen} onOpenChange={setIsWorkspaceOpen}>
          <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-lg flex items-center gap-2">
                    {selectedAssignment.task.title}
                    <Badge variant="outline" className="uppercase font-mono text-xs">
                      {selectedAssignment.task.language}
                    </Badge>
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Status: <strong className="text-foreground">{selectedAssignment.status}</strong>
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              {/* Left Column: Problem Statement & Instructions */}
              <div className="space-y-4 text-sm">
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-semibold">Problem Statement</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 whitespace-pre-wrap font-sans leading-relaxed text-xs">
                    {selectedAssignment.task.description}
                  </CardContent>
                </Card>

                {selectedAssignment.task.instructions && (
                  <Card>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm font-semibold">Instructions</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 whitespace-pre-wrap text-xs text-muted-foreground">
                      {selectedAssignment.task.instructions}
                    </CardContent>
                  </Card>
                )}

                {selectedAssignment.task.expected_output && (
                  <Card>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm font-semibold">Expected Output</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <pre className="p-3 bg-muted rounded-md text-xs font-mono whitespace-pre-wrap overflow-x-auto">
                        {selectedAssignment.task.expected_output}
                      </pre>
                    </CardContent>
                  </Card>
                )}

                {/* Attached Document Rendering */}
                {selectedAssignment.task.document && (
                  <Card>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm font-semibold flex items-center justify-between">
                        <span>Attached Task Document</span>
                        <span className="text-xs font-mono font-normal text-muted-foreground">
                          {selectedAssignment.task.document.original_name}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      {loadingDoc ? (
                        <p className="text-xs text-muted-foreground">Loading document content...</p>
                      ) : docContent ? (
                        <div className="p-3 bg-muted/60 rounded-md text-xs font-mono max-h-48 overflow-y-auto whitespace-pre-wrap">
                          {docContent}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Document file: {selectedAssignment.task.document.original_name}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right Column: Code Editor & Submission Workflow */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-semibold">Code Workspace</CardTitle>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="source-file-upload" className="cursor-pointer">
                        <span className="inline-flex items-center gap-1 text-xs border rounded px-2.5 py-1 hover:bg-accent">
                          <Upload className="w-3.5 h-3.5" /> Upload .py/.sql
                        </span>
                      </Label>
                      <Input
                        id="source-file-upload"
                        type="file"
                        accept=".py,.sql"
                        className="hidden"
                        onChange={handleFileUploadToEditor}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <Textarea
                      rows={14}
                      className="font-mono text-xs leading-relaxed resize-y bg-background"
                      placeholder={`# Write or paste your ${selectedAssignment.task.language.toUpperCase()} solution code here...`}
                      value={editorCode}
                      onChange={(e) => setEditorCode(e.target.value)}
                    />

                    <div className="flex items-center justify-between pt-1">
                      <p className="text-[11px] text-muted-foreground">
                        Validates the current content of the editor above.
                      </p>
                      <Button
                        onClick={handleValidateCode}
                        disabled={isValidating}
                        className="gap-2"
                      >
                        <Play className="w-4 h-4" />
                        {isValidating ? "Validating..." : "Validate Solution"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* 3-Level Validation Status Section */}
                {latestReport && (
                  <Card className="border-primary/30">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm font-semibold flex items-center justify-between">
                        <span>Validation Pipeline Result</span>
                        <Badge
                          className={
                            latestReport.verdict === "accepted"
                              ? "bg-green-500/15 text-green-600"
                              : "bg-red-500/15 text-red-600"
                          }
                        >
                          Overall: {latestReport.verdict === "accepted" ? "ACCEPTED" : "REJECTED"}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-3">
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        {/* Level 1: Syntax */}
                        <div className="p-2 border rounded-md">
                          <p className="text-muted-foreground font-medium">1. Syntax</p>
                          {latestReport.executionStatus === "error" &&
                          /syntax|error|invalid/i.test(latestReport.execution.error || "") ? (
                            <span className="text-destructive font-bold flex items-center justify-center gap-1 mt-1">
                              <XCircle className="w-3.5 h-3.5" /> Failed
                            </span>
                          ) : (
                            <span className="text-green-600 font-bold flex items-center justify-center gap-1 mt-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Passed
                            </span>
                          )}
                        </div>

                        {/* Level 2: Execution */}
                        <div className="p-2 border rounded-md">
                          <p className="text-muted-foreground font-medium">2. Execution</p>
                          {latestReport.executionStatus === "success" ? (
                            <span className="text-green-600 font-bold flex items-center justify-center gap-1 mt-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Successful
                            </span>
                          ) : (
                            <span className="text-destructive font-bold flex items-center justify-center gap-1 mt-1">
                              <XCircle className="w-3.5 h-3.5" /> Error
                            </span>
                          )}
                        </div>

                        {/* Level 3: Output Match */}
                        <div className="p-2 border rounded-md">
                          <p className="text-muted-foreground font-medium">3. Output Match</p>
                          {latestReport.outputMatch.matched ? (
                            <span className="text-green-600 font-bold flex items-center justify-center gap-1 mt-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Matched
                            </span>
                          ) : selectedAssignment.task.expected_output ? (
                            <span className="text-destructive font-bold flex items-center justify-center gap-1 mt-1">
                              <XCircle className="w-3.5 h-3.5" /> Mismatch
                            </span>
                          ) : (
                            <span className="text-muted-foreground font-bold flex items-center justify-center gap-1 mt-1">
                              Not Compared
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Execution Details / Output / Error Output */}
                      {latestReport.execution.output && (
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">Actual Output:</Label>
                          <pre className="p-2.5 bg-muted rounded text-[11px] font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                            {latestReport.execution.output}
                          </pre>
                        </div>
                      )}

                      {latestReport.execution.error && (
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold text-destructive">Execution Error:</Label>
                          <pre className="p-2.5 bg-destructive/10 text-destructive rounded text-[11px] font-mono whitespace-pre-wrap">
                            {latestReport.execution.error}
                          </pre>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Final Assessment Submission Button */}
                <div className="pt-2 border-t flex items-center justify-between">
                  <div>
                    {selectedAssignment.status === "Completed" && (
                      <p className="text-xs text-green-600 font-medium">
                        ✓ All validation criteria satisfied! Ready to submit assessment.
                      </p>
                    )}
                    {selectedAssignment.status === "Submitted" && (
                      <p className="text-xs text-emerald-600 font-medium">
                        ✓ Assessment submitted on {new Date(selectedAssignment.submitted_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleSubmitFinal}
                    disabled={
                      isSubmittingFinal ||
                      (selectedAssignment.status !== "Completed" &&
                        selectedAssignment.status !== "Submitted")
                    }
                    className="gap-2"
                  >
                    <Send className="w-4 h-4" />
                    {isSubmittingFinal
                      ? "Submitting..."
                      : selectedAssignment.status === "Submitted"
                      ? "Resubmit Assessment"
                      : "Submit Assessment"}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
