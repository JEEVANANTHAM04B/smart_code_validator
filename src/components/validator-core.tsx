import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Eraser,
  Trash2,
  FileText,
  Eye,
  Plus,
  Send,
  HelpCircle,
  Clock,
  Check,
  Copy,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { CodeEditor } from "@/components/code-editor";
import { ValidationReportView } from "@/components/validation-report-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createSubmissionFn, publishSubmissionFn } from "@/lib/submissions.functions";
import { validateSubmission } from "@/lib/validation.functions";
import { DEPARTMENTS, type Language, type ValidationReport } from "@/lib/validation-types";

const PYTHON_STARTER = `def solution():
    # Write Python code for this question
    pass

print(solution())
`;

const SQL_STARTER = `-- Write SQL query for this question
SELECT * FROM employees;
`;

import { submitTaskAttemptFn, submitFinalTaskAssessmentFn } from "@/lib/tasks.functions";

export interface QuestionValidationResult {
  id: string;
  questionNumber: number;
  question: string;
  expectedOutput?: string;
  code: string;
  language: Language;
  verdict: "accepted" | "rejected";
  score: number;
  report: ValidationReport;
}

interface ValidatorCoreProps {
  assignmentId?: string | undefined;
  fixedEmployeeName?: string | undefined;
  fixedEmployeeCode?: string | undefined;
  fixedDepartment?: string | undefined;
  employeeUuid?: string | undefined;
  fileId?: string | undefined;
  documentName?: string | undefined;
  documentContent?: string | undefined;
  docxHtml?: string | undefined;
  fileUrl?: string | undefined;
  fileType?: string | undefined;
  initialQuestion?: string | undefined;
  initialExpectedOutput?: string | undefined;
  initialCode?: string | undefined;
  initialLanguage?: Language | undefined;
  onHistoryClick?: (() => void) | undefined;
}

export function ValidatorCore({
  assignmentId,
  fixedEmployeeName,
  fixedEmployeeCode,
  fixedDepartment,
  employeeUuid,
  fileId,
  documentName,
  documentContent,
  docxHtml,
  fileUrl,
  fileType,
  initialQuestion,
  initialExpectedOutput,
  initialCode,
  initialLanguage,
  onHistoryClick,
}: ValidatorCoreProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const validate = useServerFn(validateSubmission);
  const createSubmission = useServerFn(createSubmissionFn);
  const submitTaskAttempt = useServerFn(submitTaskAttemptFn);
  const submitFinalTaskAssessment = useServerFn(submitFinalTaskAssessmentFn);

  // Document Viewer Modal State
  const [isDocViewerOpen, setIsDocViewerOpen] = useState(false);
  const [copiedDoc, setCopiedDoc] = useState(false);

  // DOCX & PDF Rendering State
  const docxContainerRef = useRef<HTMLDivElement>(null);
  const [docxLoading, setDocxLoading] = useState(false);
  const [docxError, setDocxError] = useState<string | null>(null);
  const [docxExtractedText, setDocxExtractedText] = useState<string>(documentContent || "");

  const ext = (documentName || "").split(".").pop()?.toLowerCase();
  const isPdf = ext === "pdf" || fileType?.toLowerCase().includes("pdf");
  const isDocx = ext === "docx" || fileType?.toLowerCase().includes("word") || fileType?.toLowerCase().includes("officedocument");

  useEffect(() => {
    if (documentContent) {
      setDocxExtractedText(documentContent);
    }
  }, [documentContent]);

  useEffect(() => {
    if (!isDocViewerOpen || !isDocx) return;
    let isCancelled = false;
    setDocxLoading(true);
    setDocxError(null);

    const renderFallbackHtml = () => {
      if (docxContainerRef.current && !isCancelled) {
        const content = docxHtml || documentContent || "";
        if (content.trim()) {
          const isFullHtml = content.includes("<p>") || content.includes("<div>");
          docxContainerRef.current.innerHTML = isFullHtml
            ? `<div class="prose dark:prose-invert p-6 max-w-none">${content}</div>`
            : `<pre class="whitespace-pre-wrap font-mono text-sm p-4 text-foreground">${content}</pre>`;
        } else {
          setDocxError("No document text content available.");
        }
      }
    };

    if (!fileUrl) {
      renderFallbackHtml();
      setDocxLoading(false);
      return;
    }

    fetch(fileUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then(async (buffer) => {
        if (isCancelled) return;

        try {
          const mammoth = await import("mammoth");
          const result = await mammoth.extractRawText({ arrayBuffer: buffer });
          if (!isCancelled && result.value) {
            setDocxExtractedText(result.value);
          }
        } catch (e) {
          console.warn("Mammoth text extraction warning", e);
        }

        if (docxContainerRef.current && !isCancelled) {
          docxContainerRef.current.innerHTML = "";
          try {
            const docxPreview = await import("docx-preview");
            await docxPreview.renderAsync(buffer, docxContainerRef.current, undefined, {
              inWrapper: false,
              ignoreWidth: false,
              ignoreHeight: false,
              experimental: true,
            });
          } catch (previewErr) {
            console.warn("docx-preview rendering failed, falling back to server HTML", previewErr);
            renderFallbackHtml();
          }
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.warn("Failed to load DOCX binary, using pre-extracted HTML/text fallback", err);
          renderFallbackHtml();
        }
      })
      .finally(() => {
        if (!isCancelled) setDocxLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isDocViewerOpen, isDocx, fileUrl, docxHtml, documentContent]);

  // Question & Submission Form State
  const [currentQuestionNum, setCurrentQuestionNum] = useState(1);
  const [totalQuestionsInput, setTotalQuestionsInput] = useState(5);
  const [question, setQuestion] = useState(
    initialQuestion ?? "Question 1: Write a program to solve the requirement."
  );
  const [expectedOutput, setExpectedOutput] = useState(initialExpectedOutput ?? "");
  const [employeeName, setEmployeeName] = useState(fixedEmployeeName ?? "");
  const [employeeCode, setEmployeeCode] = useState(fixedEmployeeCode ?? "");
  const [department, setDepartment] = useState<string>(fixedDepartment ?? DEPARTMENTS[0]);
  const [language, setLanguage] = useState<Language>(initialLanguage ?? "python");
  const [code, setCode] = useState(initialCode ?? "");

  useEffect(() => {
    if (initialLanguage) setLanguage(initialLanguage);
  }, [initialLanguage]);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [reviewedCode, setReviewedCode] = useState("");
  const [reviewedLanguage, setReviewedLanguage] = useState<Language>("python");
  const [reviewedMeta, setReviewedMeta] = useState<{
    employeeName: string;
    employeeCode: string;
    department: string;
    question: string;
  } | null>(null);

  // Multi-Question Validation Tracking State
  const [validatedQuestions, setValidatedQuestions] = useState<QuestionValidationResult[]>([]);
  const [isSubmittingComplete, setIsSubmittingComplete] = useState(false);

  useEffect(() => {
    if (fixedEmployeeName) setEmployeeName(fixedEmployeeName);
    if (fixedEmployeeCode) setEmployeeCode(fixedEmployeeCode);
    if (fixedDepartment) setDepartment(fixedDepartment);
  }, [fixedEmployeeName, fixedEmployeeCode, fixedDepartment]);

  useEffect(() => {
    if (initialQuestion) setQuestion(initialQuestion);
    if (initialExpectedOutput) setExpectedOutput(initialExpectedOutput);
    if (initialCode !== undefined) setCode(initialCode);
  }, [initialQuestion, initialExpectedOutput, initialCode]);

  const switchLanguage = (next: Language) => {
    setLanguage(next);
    if (!code.trim()) {
      setCode(next === "python" ? PYTHON_STARTER : SQL_STARTER);
    }
  };

  const [stage, setStage] = useState<"idle" | "executing" | "reviewing">("idle");

  const handleClearAll = () => {
    setQuestion("");
    setExpectedOutput("");
    setCode("");
    setReport(null);
    toast.info("Cleared question form");
  };

  const copyDocumentContent = () => {
    const textToCopy = docxExtractedText || documentContent || "";
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedDoc(true);
      toast.success("Document text copied to clipboard");
      setTimeout(() => setCopiedDoc(false), 2000);
    } else {
      toast.error("No text content available to copy");
    }
  };

  // Validate Individual Question Mutation
  const mutation = useMutation({
    mutationFn: async () => {
      setStage("executing");
      const { executeSubmission } = await import("@/lib/code-execution");
      const execution = await executeSubmission(language, code, question, expectedOutput.trim() || undefined);

      setStage("reviewing");
      const result = await validate({
        data: {
          question: question.trim(),
          expectedOutput: expectedOutput.trim() || undefined,
          code,
          language,
          employeeName: employeeName.trim(),
          employeeCode: employeeCode.trim(),
          department,
          execution,
        },
      });

      return result;
    },
    onSettled: () => setStage("idle"),
    onSuccess: (result) => {
      setReport(result);
      setReviewedCode(code);
      setReviewedLanguage(language);
      setReviewedMeta({
        employeeName: employeeName.trim(),
        employeeCode: employeeCode.trim(),
        department,
        question: question.trim(),
      });

      // Update or Add to validated questions tracking array
      const newQuestionResult: QuestionValidationResult = {
        id: `q-${currentQuestionNum}-${Date.now()}`,
        questionNumber: currentQuestionNum,
        question: question.trim(),
        expectedOutput: expectedOutput.trim(),
        code,
        language,
        verdict: result.verdict,
        score: result.scores.overall,
        report: result,
      };

      setValidatedQuestions((prev) => {
        const filtered = prev.filter((q) => q.questionNumber !== currentQuestionNum);
        return [...filtered, newQuestionResult].sort((a, b) => a.questionNumber - b.questionNumber);
      });

      if (assignmentId) {
        submitTaskAttempt({
          data: {
            assignmentId,
            code,
          },
        }).catch((err) => console.warn("Task attempt recording warning:", err));
      }

      toast.success(
        result.verdict === "accepted"
          ? `Question ${currentQuestionNum} validated: ACCEPTED (${result.scores.overall}%)`
          : `Question ${currentQuestionNum} validated: REJECTED — ${result.outputMatch?.reason ?? "output mismatch"}`
      );
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Validation failed.";
      toast.error(message.includes("402") ? "AI credits exhausted for this workspace." : message);
    },
  });

  // Prepare for Next Question
  const handleNextQuestion = () => {
    const nextNum = currentQuestionNum + 1;
    setCurrentQuestionNum(nextNum);
    setQuestion(`Question ${nextNum}: `);
    setExpectedOutput("");
    setCode("");
    setReport(null);
    toast.info(`Moved to Question ${nextNum}`);
  };

  // Submit Complete Assessment (Aggregates all question results)
  const handleSubmitCompleteAssessment = async () => {
    if (validatedQuestions.length === 0) {
      toast.error("Please validate at least one question before submitting.");
      return;
    }

    setIsSubmittingComplete(true);
    try {
      const correctCount = validatedQuestions.filter((q) => q.verdict === "accepted").length;
      const wrongCount = validatedQuestions.filter((q) => q.verdict === "rejected").length;
      const overallVerdict = correctCount >= wrongCount ? "accepted" : "rejected";
      const totalScoreSum = validatedQuestions.reduce((sum, q) => sum + q.score, 0);
      const overallAvgScore = Math.round(totalScoreSum / validatedQuestions.length);

      const firstQ = validatedQuestions[0];
      if (!firstQ) {
        toast.error("No validated questions found.");
        return;
      }
      const firstReport = firstQ.report;
      const combinedReport: ValidationReport = {
        ...firstReport,
        verdict: overallVerdict,
        summary: `Complete Assessment Submission (${validatedQuestions.length} questions evaluated. ${correctCount} Correct, ${wrongCount} Wrong. Average Score: ${overallAvgScore}%).`,
        scores: {
          ...(firstReport?.scores || {
            overall: 0,
            logic: 0,
            syntax: 0,
            quality: 0,
            efficiency: 0,
            bestPractices: 0,
            outputMatch: 0,
            readability: 0,
          }),
          overall: overallAvgScore,
        },
        question_results: validatedQuestions.map((q) => ({
          questionNumber: q.questionNumber,
          question: q.question,
          verdict: q.verdict,
          score: q.score,
          code: q.code,
          language: q.language,
        })),
      };

      await createSubmission({
        data: {
          employeeName: employeeName.trim(),
          employeeCode: employeeCode.trim(),
          department,
          language: firstQ.language,
          question: `Assessment Document Submission (${validatedQuestions.length} Questions)`,
          expectedOutput: undefined,
          code: validatedQuestions.map((q) => `# --- Question ${q.questionNumber} ---\n${q.code}`).join("\n\n"),
          report: combinedReport,
          employee_uuid: employeeUuid,
          file_id: fileId,
          is_published: true, // Submit and Publish immediately to Employee
          correct_count: correctCount,
          wrong_count: wrongCount,
          total_questions: Math.max(totalQuestionsInput, validatedQuestions.length),
        } as any,
      });

      if (assignmentId) {
        await submitFinalTaskAssessment({
          data: { assignmentId },
        });
        toast.success("Assigned assessment submitted successfully!");
        void queryClient.invalidateQueries({ queryKey: ["tasks"] });
        setTimeout(() => {
          navigate({ to: "/employee/tasks" });
        }, 1500);
        return;
      }

      toast.success("Complete assessment submitted and published to employee successfully!");
      void queryClient.invalidateQueries({ queryKey: ["submissions"] });
      void queryClient.invalidateQueries({ queryKey: ["files"] });

      setTimeout(() => {
        navigate({ to: "/admin/files" });
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit complete assessment");
    } finally {
      setIsSubmittingComplete(false);
    }
  };

  // Question validation stats counters
  const validatedCount = validatedQuestions.length;
  const correctCount = validatedQuestions.filter((q) => q.verdict === "accepted").length;
  const wrongCount = validatedQuestions.filter((q) => q.verdict === "rejected").length;
  const pendingCount = Math.max(0, totalQuestionsInput - validatedCount);

  const canSubmitQuestion =
    question.trim().length >= 5 &&
    code.trim().length > 0 &&
    employeeName.trim().length >= 2 &&
    employeeCode.trim().length >= 1;

  const isEmployeeFixed = !!fixedEmployeeCode;

  return (
    <div className="space-y-8">
      {/* Header & View Document Button */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-gradient">Question-by-Question Code Validator</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review the uploaded assessment document, select questions, validate code in sandboxes, and submit complete results.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {(fileUrl || documentContent) && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsDocViewerOpen(true)}
              className="gap-2 font-semibold shadow bg-primary text-primary-foreground"
            >
              <FileText className="size-4" /> View Document
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="size-3.5" /> Clear Form
          </Button>
        </div>
      </header>

      {/* Document Viewer Modal */}
      <Dialog open={isDocViewerOpen} onOpenChange={setIsDocViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-primary" />
              Document Viewer: {documentName || "Uploaded Assessment"}
            </DialogTitle>
            <DialogDescription>
              Original document uploaded by {employeeName || "employee"}. Copy question code into the editor below to validate.
            </DialogDescription>
          </DialogHeader>

          {isPdf ? (
            <div className="flex-1 min-h-[500px] h-[65vh] rounded-md border overflow-hidden bg-background my-2">
              {fileUrl ? (
                <iframe
                  src={fileUrl}
                  className="w-full h-full border-0"
                  title={documentName || "PDF Document"}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  PDF URL unavailable.
                </div>
              )}
            </div>
          ) : isDocx ? (
            <div className="flex-1 min-h-[500px] h-[65vh] overflow-y-auto p-4 bg-muted/20 rounded-md border my-2 select-text relative">
              {docxLoading && (
                <div className="flex items-center justify-center p-12 text-sm text-muted-foreground gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  Rendering Word document preview...
                </div>
              )}
              {docxError && (
                <div className="p-4 text-sm text-destructive bg-destructive/10 rounded">
                  {docxError}
                </div>
              )}
              <div
                ref={docxContainerRef}
                className="docx-preview-container max-w-none font-sans text-sm text-foreground space-y-4"
              />
            </div>
          ) : (
            <pre className="flex-1 overflow-y-auto max-h-[65vh] p-4 bg-muted/40 rounded-md font-mono text-sm leading-relaxed border my-2 whitespace-pre-wrap select-text text-foreground">
              {documentContent || "No document text content available."}
            </pre>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="sm" onClick={copyDocumentContent} className="gap-1.5">
              {copiedDoc ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              {copiedDoc ? "Copied!" : "Copy Full Text"}
            </Button>
            <Button variant="default" size="sm" onClick={() => setIsDocViewerOpen(false)}>
              Close Viewer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Question Progress & Status Section (Requirement 4) */}
      <Card className="border-primary/30 bg-card shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Assessment Question Validation Tracker
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="totalQs" className="text-xs text-muted-foreground">Total Questions:</Label>
            <Input
              id="totalQs"
              type="number"
              min={1}
              max={50}
              value={totalQuestionsInput}
              onChange={(e) => setTotalQuestionsInput(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 h-8 text-xs font-mono text-center"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary Badges Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 rounded-lg border bg-background text-center">
              <span className="text-xs text-muted-foreground block">Total Questions</span>
              <span className="text-xl font-bold font-mono">{totalQuestionsInput}</span>
            </div>
            <div className="p-3 rounded-lg border bg-background text-center">
              <span className="text-xs text-muted-foreground block">Validated</span>
              <span className="text-xl font-bold font-mono text-primary">{validatedCount}</span>
            </div>
            <div className="p-3 rounded-lg border bg-background text-center">
              <span className="text-xs text-muted-foreground block">Correct</span>
              <span className="text-xl font-bold font-mono text-green-600">{correctCount}</span>
            </div>
            <div className="p-3 rounded-lg border bg-background text-center">
              <span className="text-xs text-muted-foreground block">Wrong</span>
              <span className="text-xl font-bold font-mono text-destructive">{wrongCount}</span>
            </div>
            <div className="p-3 rounded-lg border bg-background text-center">
              <span className="text-xs text-muted-foreground block">Pending</span>
              <span className="text-xl font-bold font-mono text-amber-600">{pendingCount}</span>
            </div>
          </div>

          {/* Question List Status Badges */}
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-semibold text-muted-foreground">Question Status Breakdown:</p>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: totalQuestionsInput }).map((_, idx) => {
                const qNum = idx + 1;
                const validatedQ = validatedQuestions.find((q) => q.questionNumber === qNum);
                const isCurrent = currentQuestionNum === qNum;

                return (
                  <Button
                    key={qNum}
                    variant={isCurrent ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setCurrentQuestionNum(qNum);
                      if (validatedQ) {
                        setQuestion(validatedQ.question);
                        setExpectedOutput(validatedQ.expectedOutput || "");
                        setCode(validatedQ.code);
                        setLanguage(validatedQ.language);
                        setReport(validatedQ.report);
                      } else {
                        setQuestion(`Question ${qNum}: `);
                        setExpectedOutput("");
                        setCode("");
                        setReport(null);
                      }
                    }}
                    className={`gap-1.5 text-xs ${
                      validatedQ?.verdict === "accepted"
                        ? "border-green-600 text-green-600 hover:bg-green-500/10"
                        : validatedQ?.verdict === "rejected"
                        ? "border-destructive text-destructive hover:bg-destructive/10"
                        : ""
                    }`}
                  >
                    {validatedQ?.verdict === "accepted" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    ) : validatedQ?.verdict === "rejected" ? (
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-amber-600" />
                    )}
                    Question {qNum}
                    {validatedQ && (
                      <span className="ml-1 text-[10px] font-mono opacity-80">({validatedQ.score}%)</span>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Complete Assessment Submit Bar (Requirement 5) */}
          <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-primary/10 rounded-lg gap-4 border border-primary/20">
            <div>
              <p className="text-sm font-semibold">Ready to Finalize Complete Assessment?</p>
              <p className="text-xs text-muted-foreground">
                {validatedCount === 0
                  ? "Validate questions above before submitting."
                  : `Validated ${validatedCount} of ${totalQuestionsInput} questions (${correctCount} Correct, ${wrongCount} Wrong).`}
              </p>
            </div>
            <Button
              size="lg"
              onClick={handleSubmitCompleteAssessment}
              disabled={validatedCount === 0 || isSubmittingComplete}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white font-bold shrink-0 shadow"
            >
              {isSubmittingComplete ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" /> Submit Complete Assessment
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Code Validation Input Form */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">
                Question {currentQuestionNum} Description & Prompt
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => setQuestion("")}
              >
                <Eraser className="size-3.5" /> Clear
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={3}
                maxLength={4000}
                placeholder="Enter question text or description..."
                className="resize-y text-sm"
              />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="expected">Expected Output (Optional)</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setExpectedOutput("")}
                  >
                    <Eraser className="size-3" /> Clear output
                  </Button>
                </div>
                <Textarea
                  id="expected"
                  value={expectedOutput}
                  onChange={(event) => setExpectedOutput(event.target.value)}
                  rows={2}
                  maxLength={4000}
                  placeholder="Expected output string or dataset result..."
                  className="resize-y font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">
                Question {currentQuestionNum} Code Submission
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setCode("")}
                >
                  <Eraser className="size-3.5" /> Clear code
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setCode(language === "python" ? PYTHON_STARTER : SQL_STARTER)}
                >
                  <RotateCcw className="size-3.5" /> Starter Code
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <CodeEditor value={code} onChange={setCode} language={language} />
            </CardContent>
          </Card>
        </div>

        {/* Employee Info & Validation Action */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Employee & Question Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Employee Name</Label>
                <Input
                  id="name"
                  value={employeeName}
                  onChange={(event) => setEmployeeName(event.target.value)}
                  maxLength={80}
                  placeholder="Aarav Sharma"
                  disabled={isEmployeeFixed}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Employee ID</Label>
                <Input
                  id="code"
                  value={employeeCode}
                  onChange={(event) => setEmployeeCode(event.target.value)}
                  maxLength={40}
                  placeholder="EMP-1042"
                  disabled={isEmployeeFixed}
                />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={department} onValueChange={setDepartment} disabled={isEmployeeFixed}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Programming Language</Label>
                <Select value={language} onValueChange={(value) => switchLanguage(value as Language)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="python">Python</SelectItem>
                    <SelectItem value="sql">SQL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full gap-2"
                size="lg"
                disabled={!canSubmitQuestion || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Validating Q{currentQuestionNum}…
                  </>
                ) : (
                  <>
                    <Play className="size-4" /> Validate Question {currentQuestionNum}
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleNextQuestion}
              >
                <Plus className="size-4" /> Next Question
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {mutation.isPending && (
        <div className="panel flex items-center gap-3 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin text-primary" />
          {stage === "executing"
            ? `Executing Question ${currentQuestionNum} code in WebAssembly sandbox…`
            : `Evaluating Question ${currentQuestionNum} output and generating AI insights…`}
        </div>
      )}

      {report && (
        <ValidationReportView
          report={report}
          language={reviewedLanguage}
          submittedCode={reviewedCode}
          {...(reviewedMeta
            ? { meta: { ...reviewedMeta, language: reviewedLanguage, code: reviewedCode } }
            : {})}
        />
      )}
    </div>
  );
}
