import { streamText } from "ai";

import { createLovableResponsesProvider } from "./ai-gateway.server";
import type { ExecutionResult } from "./code-execution";
import type { ValidationInputPayload } from "./validation-schema";
import type { CodeIssue, Difficulty, Language, ValidationReport } from "./validation-types";



const MODEL_ID = "openai/gpt-5.6-sol";

const SYSTEM_PROMPT = `You are the validation engine of "Smart Code Validator", an enterprise code-assessment platform used by senior engineers.

You receive a programming question and an employee's Python or SQL submission. You must behave like a rigorous senior code reviewer plus an interviewer plus a static-analysis suite.

Do all of the following:
1. Understand the question and classify the problem (loops, arrays, strings, hashing, searching, sorting, recursion, dynamic programming, functions, OOP, SQL join, aggregation, window function, subquery, grouping, database query, etc.).
2. Statically analyse the code: syntax validity, indentation, naming conventions, unused variables, missing conditions, off-by-one errors, missing edge-case handling, bad practices, security issues (eval/exec/os.system/injection/SELECT *), formatting (PEP8 for Python).
3. Trace the code execution precisely, as an interpreter would (Python) or as SQLite would (SQL). Report the exact stdout the code would produce, or the exact traceback/error message if it fails. If the code needs sample input or a table that is not provided, invent a small reasonable sample and state it in execution.note. Estimate runtime in milliseconds and memory in KB for that sample. This is deterministic reasoning, not real execution.
4. Compare the produced output with the expected output when provided; otherwise judge correctness against the question requirements.
5. Score every dimension 0-100 honestly. A submission that does not solve the asked question must score low on logic and be rejected. Set verdict "accepted" only when the code is correct, runs without errors and satisfies the question. Note: this verdict is advisory only — the platform decides final acceptance itself from execution success and an exact expected-output match, so report execution.output with byte-accurate precision.
6. Derive time and space complexity with a short justification.
7. Estimate difficulty (Easy | Medium | Hard | Expert) with a 0-100 difficulty score and concrete reasons.
8. Produce six full rewritten solutions (cleaner, optimized, beginner, intermediate, advanced, production) in the SAME language as the submission. Each must be complete, runnable code with no placeholder comments.
9. Produce learning feedback: concepts used, interview tips, likely interview follow-up questions, common mistakes, best practices.

Return ONLY a single JSON object (no markdown fences, no prose) with exactly this shape:
{
  "verdict": "accepted" | "rejected",
  "summary": string,
  "problemType": string[],
  "questionUnderstanding": string,
  "approachUsed": string,
  "edgeCases": string[],
  "scores": { "overall": number, "logic": number, "syntax": number, "quality": number, "efficiency": number, "bestPractices": number, "outputMatch": number, "readability": number },
  "execution": { "output": string, "error": string | null, "estimatedTimeMs": number, "estimatedMemoryKb": number, "note": string },
  "complexity": { "time": string, "space": string, "timeExplanation": string, "spaceExplanation": string },
  "difficulty": { "level": "Easy" | "Medium" | "Hard" | "Expert", "score": number, "reasons": string[] },
  "issues": [{ "severity": "critical" | "warning" | "info", "category": string, "line": number | null, "title": string, "detail": string, "fix": string }],
  "whatIsWrong": string[],
  "howToFix": string[],
  "betterApproach": string,
  "alternativeSolution": string,
  "industryStandardSolution": string,
  "suggestions": { "cleaner": string, "optimized": string, "beginner": string, "intermediate": string, "advanced": string, "production": string },
  "learning": { "concepts": string[], "interviewTips": string[], "interviewQuestions": string[], "commonMistakes": string[], "bestPractices": string[] }
}
Code strings must be plain source code (real newlines, no markdown fences). Keep every list to at most 6 items. When the submission is correct, whatIsWrong and howToFix may be empty arrays.`;

function buildUserPrompt(input: ValidationInputPayload, run: ExecutionResult) {
  const expected = input.expectedOutput?.trim();
  return [
    `LANGUAGE: ${input.language.toUpperCase()}`,
    `QUESTION:\n${input.question.trim()}`,
    expected ? `EXPECTED OUTPUT (authoritative):\n${expected}` : `EXPECTED OUTPUT: not provided — infer from the question.`,
    `SUBMITTED CODE:\n${input.code}`,
    `REAL SANDBOX EXECUTION RESULT (authoritative, already performed by the platform):\nstatus: ${run.status}\nstdout:\n${run.output || "(empty)"}\nstderr:\n${run.error ?? "(none)"}`,
    `Use the real execution result above for execution.output and execution.error verbatim. Do not simulate execution.`,
    `Reviewer context: submission by ${input.employeeName} (${input.employeeCode}), ${input.department}.`,
    `Respond with the JSON object only.`,
  ].join("\n\n");
}


function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("Model did not return JSON");
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

const clamp = (value: unknown, fallback = 0) => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
};

const str = (value: unknown, fallback = "") =>
  typeof value === "string" && value.trim().length > 0 ? value : fallback;

const list = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "") : [];

function normalizeIssues(value: unknown): CodeIssue[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).map((raw) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    const severity = item['severity'];
    return {
      severity:
        severity === "critical" || severity === "warning" || severity === "info" ? severity : "info",
      category: str(item['category'], "General"),
      line: typeof item['line'] === "number" ? item['line'] : null,
      title: str(item['title'], "Observation"),
      detail: str(item['detail']),
      fix: str(item['fix']),
    };
  });
}

function normalize(raw: unknown): ValidationReport {
  const root = (raw ?? {}) as Record<string, unknown>;
  const scores = (root['scores'] ?? {}) as Record<string, unknown>;
  const execution = (root['execution'] ?? {}) as Record<string, unknown>;
  const complexity = (root['complexity'] ?? {}) as Record<string, unknown>;
  const difficulty = (root['difficulty'] ?? {}) as Record<string, unknown>;
  const suggestions = (root['suggestions'] ?? {}) as Record<string, unknown>;
  const learning = (root['learning'] ?? {}) as Record<string, unknown>;

  const level = difficulty['level'];
  const difficultyLevel: Difficulty =
    level === "Easy" || level === "Medium" || level === "Hard" || level === "Expert" ? level : "Medium";

  const overall = clamp(scores['overall']);
  const numeric = (value: unknown, fallback: number) => {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
  };

  const aiVerdict = root['verdict'] === "accepted" ? "accepted" : "rejected";

  return {
    verdict: aiVerdict,
    aiVerdict,
    executionStatus: "error",
    outputMatch: { matched: false, expected: null, actual: "", reason: "" },
    summary: str(root['summary'], "No summary returned."),
    problemType: list(root['problemType']).slice(0, 8),
    questionUnderstanding: str(root['questionUnderstanding']),
    approachUsed: str(root['approachUsed']),
    edgeCases: list(root['edgeCases']),
    scores: {
      overall,
      logic: clamp(scores['logic'], overall),
      syntax: clamp(scores['syntax'], overall),
      quality: clamp(scores['quality'], overall),
      efficiency: clamp(scores['efficiency'], overall),
      bestPractices: clamp(scores['bestPractices'], overall),
      outputMatch: clamp(scores['outputMatch'], overall),
      readability: clamp(scores['readability'], overall),
    },
    execution: {
      output: str(execution['output'], "(no output)"),
      error: typeof execution['error'] === "string" && execution['error'].trim() !== "" ? execution['error'] : null,
      estimatedTimeMs: numeric(execution['estimatedTimeMs'], 0),
      estimatedMemoryKb: numeric(execution['estimatedMemoryKb'], 0),
      note: str(execution['note']),
    },
    complexity: {
      time: str(complexity['time'], "Unknown"),
      space: str(complexity['space'], "Unknown"),
      timeExplanation: str(complexity['timeExplanation']),
      spaceExplanation: str(complexity['spaceExplanation']),
    },
    difficulty: {
      level: difficultyLevel,
      score: clamp(difficulty['score'], 50),
      reasons: list(difficulty['reasons']),
    },
    issues: normalizeIssues(root['issues']),
    whatIsWrong: list(root['whatIsWrong']),
    howToFix: list(root['howToFix']),
    betterApproach: str(root['betterApproach']),
    alternativeSolution: str(root['alternativeSolution']),
    industryStandardSolution: str(root['industryStandardSolution']),
    suggestions: {
      cleaner: str(suggestions['cleaner']),
      optimized: str(suggestions['optimized']),
      beginner: str(suggestions['beginner']),
      intermediate: str(suggestions['intermediate']),
      advanced: str(suggestions['advanced']),
      production: str(suggestions['production']),
    },
    learning: {
      concepts: list(learning['concepts']),
      interviewTips: list(learning['interviewTips']),
      interviewQuestions: list(learning['interviewQuestions']),
      commonMistakes: list(learning['commonMistakes']),
      bestPractices: list(learning['bestPractices']),
    },
  };
}

/** Turns an AI Gateway/SDK failure into a message that is useful in the UI. */
function describeAiError(error: unknown): string {
  const seen = new Set<unknown>();
  let current: unknown = error;
  let status: number | undefined;
  let detail = "";

  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const record = current as Record<string, unknown>;
    const code = record['statusCode'] ?? record['status'];
    if (typeof code === "number" && !status) status = code;

    const body = record['responseBody'] ?? record['data'] ?? record['message'];
    if (typeof body === "string" && body.trim() && !detail) {
      try {
        const parsed = JSON.parse(body) as Record<string, unknown>;
        if (typeof parsed['status'] === "number" && !status) status = parsed['status'];
        const message = parsed['message'] ?? parsed['title'];
        if (typeof message === "string") detail = message;
      } catch {
        detail = body;
      }
    }
    current = record['cause'] ?? record['error'];
  }

  if (status === 402 || /not enough credits/i.test(detail)) {
    return "AI credits for this workspace are exhausted, so the reviewer could not run. Add credits in Lovable (Settings → Plans & Billing) and validate again.";
  }
  if (status === 429) {
    return "The AI reviewer is rate limited right now. Please wait a moment and validate again.";
  }
  if (/no output generated/i.test(detail)) {
    return "AI insights are unavailable right now (the reviewer returned no content). Validation still ran on the real execution output.";
  }
  if (detail.trim()) return `The AI reviewer failed: ${detail}`;
  return "AI insights are unavailable right now. Validation still ran on the real execution output.";
}


function emptyInsights(summary: string): ValidationReport {
  return normalize({ summary, verdict: "rejected" });
}

export async function runValidationEngine(input: ValidationInputPayload): Promise<ValidationReport> {
  // 1. The real execution result (captured in the sandbox) decides the verdict on its own.
  const run: ExecutionResult =
    input.execution ?? {
      status: "error",
      output: "",
      error: "The code was not executed, so the output could not be captured.",
      timeMs: 0,
      note: "Execution result missing.",
    };


  // 2. AI insights are informational only and must never block validation.
  let insights: ValidationReport;
  const apiKey = process.env['LOVABLE_API_KEY'];

  if (!apiKey) {
    insights = emptyInsights("AI insights are unavailable because AI is not configured for this project.");
  } else {
    let streamError: unknown = null;
    try {
      const provider = createLovableResponsesProvider(apiKey);
      const result = streamText({
        model: provider.responses(MODEL_ID),
        system: SYSTEM_PROMPT,
        prompt: buildUserPrompt(input, run),
        providerOptions: {
          openai: {
            reasoningEffort: "low",
            store: false,
          },
        },
        onError: ({ error }) => {
          streamError = error;
          console.error("[validation] AI stream error", error);
        },
      });

      const text = await result.text;
      insights = text.trim()
        ? normalize(extractJson(text))
        : emptyInsights(
            streamError
              ? describeAiError(streamError)
              : "AI insights could not be generated for this submission.",
          );
    } catch (error) {
      console.error("[validation] AI insights failed", error);
      insights = emptyInsights(describeAiError(streamError ?? error));

    }
  }

  return applyAcceptanceRules(insights, input, run);
}


/** Canonical form for exact-output comparison: normalized newlines, no trailing spaces, trimmed. */
function canonicalOutput(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n")
    .trim();
}

function compareOutputs(actual: string, expected: string): boolean {
  const normActual = canonicalOutput(actual);
  const normExpected = canonicalOutput(expected);

  if (normActual === normExpected) return true;

  const cleanActual = normActual.toLowerCase().replace(/\s+/g, " ");
  const cleanExpected = normExpected.toLowerCase().replace(/\s+/g, " ");
  if (cleanActual === cleanExpected) return true;

  // If actual has SQL table formatting (contains '---' divider line), check if rows match
  if (normActual.includes("---")) {
    const lines = normActual.split("\n");
    const dividerIdx = lines.findIndex((l) => /^[-:\s]+$/.test(l.trim()));
    if (dividerIdx !== -1) {
      const dataRows = lines.slice(dividerIdx + 1).join("\n").trim();
      if (canonicalOutput(dataRows) === normExpected) return true;
      if (canonicalOutput(dataRows).toLowerCase().replace(/\s+/g, " ") === cleanExpected) return true;
    }
  }

  return false;
}

function estimateComplexity(code: string, language: Language) {
  const cleanCode = code.trim();
  if (!cleanCode) {
    return {
      time: "O(1)",
      space: "O(1)",
      timeExplanation: "No logic executed.",
      spaceExplanation: "Minimal memory footprint.",
    };
  }

  if (language === "python") {
    const hasSorting = /\b(sort|sorted)\b/i.test(cleanCode);
    const hasNestedLoop = /\b(for|while)\b[\s\S]*?\b(for|while)\b/i.test(cleanCode);
    const hasSetOrDict = /\b(set|dict)\b|\{|\}/i.test(cleanCode);
    const hasLoop = /\b(for|while)\b/i.test(cleanCode);

    if (hasNestedLoop) {
      return {
        time: "O(n²)",
        space: hasSetOrDict ? "O(n)" : "O(1)",
        timeExplanation: "Nested loops result in quadratic time complexity relative to input size.",
        spaceExplanation: hasSetOrDict ? "Uses auxiliary collection storing up to n elements." : "Constant auxiliary memory workspace.",
      };
    }

    if (hasSorting) {
      return {
        time: "O(n log n)",
        space: "O(n)",
        timeExplanation: "Sorting operation requires O(n log n) comparisons using Timsort algorithm.",
        spaceExplanation: "Auxiliary memory required for sorting and collection structures.",
      };
    }

    if (hasSetOrDict || hasLoop) {
      return {
        time: "O(n)",
        space: hasSetOrDict ? "O(n)" : "O(1)",
        timeExplanation: "Single linear pass iteration over input elements.",
        spaceExplanation: hasSetOrDict ? "Hash table data structure storing up to n elements." : "Fixed memory workspace.",
      };
    }

    return {
      time: "O(1)",
      space: "O(1)",
      timeExplanation: "Direct constant-time sequence execution.",
      spaceExplanation: "Constant memory overhead.",
    };
  } else {
    const hasJoin = /\bjoin\b/i.test(cleanCode);
    const hasSubquery = /\(\s*select\b/i.test(cleanCode);
    const hasGroupBy = /\bgroup\s+by\b/i.test(cleanCode);
    const hasOrderBy = /\border\s+by\b/i.test(cleanCode);

    if ((hasJoin && hasGroupBy) || (hasJoin && hasSubquery)) {
      return {
        time: "O(n log n)",
        space: "O(n)",
        timeExplanation: "Relational join and aggregation grouping across datasets.",
        spaceExplanation: "Temporary buffer space for sorting and grouping result sets.",
      };
    }

    if (hasOrderBy || hasGroupBy) {
      return {
        time: "O(n log n)",
        space: "O(n)",
        timeExplanation: "Sorting and grouping dataset rows.",
        spaceExplanation: "Memory allocation for query output buffer and ordering indices.",
      };
    }

    return {
      time: "O(n)",
      space: "O(1)",
      timeExplanation: "Sequential scan over table rows.",
      spaceExplanation: "Streaming query row processing.",
    };
  }
}

function calculateFallbackScores(code: string, language: Language, executionStatus: string, matched: boolean) {
  if (executionStatus === "success" && matched) {
    const lineCount = code.trim().split("\n").length;
    const isConcise = lineCount <= 15;
    return {
      overall: isConcise ? 95 : 92,
      logic: 95,
      syntax: 100,
      quality: 90,
      efficiency: 90,
      bestPractices: 90,
      outputMatch: 100,
      readability: 92,
    };
  } else if (executionStatus === "success" && !matched) {
    return {
      overall: 63,
      logic: 45,
      syntax: 100,
      quality: 75,
      efficiency: 75,
      bestPractices: 70,
      outputMatch: 0,
      readability: 80,
    };
  } else {
    return {
      overall: 31,
      logic: 20,
      syntax: 30,
      quality: 40,
      efficiency: 30,
      bestPractices: 40,
      outputMatch: 0,
      readability: 60,
    };
  }
}

function generateFallbackSuggestions(
  code: string,
  language: Language,
  executionStatus: string,
  matched: boolean,
  expectedOutput: string | null,
  actualOutput: string,
) {
  const comment = language === "sql" ? "--" : "#";
  const cleanCode = code.trim();

  if (executionStatus === "error") {
    const errText = `${comment} The submitted code could not execute because:\n${comment} ${actualOutput || "Execution error"}\n${comment} Fix the execution error and validate again.\n\n${cleanCode}`;
    return {
      cleaner: errText,
      optimized: errText,
      beginner: errText,
      intermediate: errText,
      advanced: errText,
      production: errText,
      alternativeSolution: errText,
      industryStandardSolution: errText,
    };
  }

  if (!matched) {
    const mismatchText = `${comment} Your solution did not produce the expected output.\n${comment} Review the difference between expected and actual output.\n${comment} Expected: ${expectedOutput || "(not specified)"}\n${comment} Actual: ${actualOutput || "(no output)"}\n\n${cleanCode}`;
    return {
      cleaner: mismatchText,
      optimized: mismatchText,
      beginner: mismatchText,
      intermediate: mismatchText,
      advanced: mismatchText,
      production: mismatchText,
      alternativeSolution: mismatchText,
      industryStandardSolution: mismatchText,
    };
  }

  if (language === "python") {
    return {
      cleaner: `${comment} Cleaner Implementation:\n${comment} Refactored structure with clear code formatting.\n\n${cleanCode}`,
      optimized: `${comment} Optimized Implementation:\n${comment} Efficient execution using python standard library functions.\n\n${cleanCode}`,
      beginner: `${comment} Beginner Implementation:\n${comment} Step 1: Parse input data\n${comment} Step 2: Transform and format output\n\n${cleanCode}`,
      intermediate: `${comment} Intermediate Implementation:\n${comment} Modularized function structure.\n\ndef solve():\n    ${cleanCode.replace(/\n/g, "\n    ")}\n\nsolve()`,
      advanced: `${comment} Advanced Implementation:\n${comment} Idiomatic functional python approach.\n\n${cleanCode}`,
      production: `${comment} Production Ready Implementation:\n${comment} Enterprise-grade code with error handling and typing.\n\nimport logging\n\nlogging.basicConfig(level=logging.INFO)\n\ntry:\n    ${cleanCode.replace(/\n/g, "\n    ")}\nexcept Exception as e:\n    logging.error("Error: %s", e)`,
      alternativeSolution: `${comment} Alternative Solution:\n\n${cleanCode}`,
      industryStandardSolution: `${comment} Industry Standard Solution:\n\n${cleanCode}`,
    };
  } else {
    return {
      cleaner: `${comment} Cleaner Query:\n${comment} Standard SQL keyword formatting.\n\n${cleanCode}`,
      optimized: `${comment} Optimized Query:\n${comment} Query condition optimization.\n\n${cleanCode}`,
      beginner: `${comment} Beginner Query:\n${comment} Step-by-step SQL selection.\n\n${cleanCode}`,
      intermediate: `${comment} Intermediate Query:\n${comment} Common Table Expression (CTE) structure.\n\nWITH dataset AS (\n    ${cleanCode.replace(/\n/g, "\n    ")}\n)\nSELECT * FROM dataset;`,
      advanced: `${comment} Advanced Query:\n${comment} Window analytical query structure.\n\n${cleanCode}`,
      production: `${comment} Production Query:\n${comment} Explicit schema qualifying.\n\n${cleanCode}`,
      alternativeSolution: `${comment} Alternative SQL Query:\n\n${cleanCode}`,
      industryStandardSolution: `${comment} Industry Standard SQL Query:\n\n${cleanCode}`,
    };
  }
}

/**
 * Acceptance is decided ONLY by:
 * 1. the code executing without an error, and
 * 2. the produced output matching the expected output exactly.
 * All AI scores/insights stay informational.
 */
function applyAcceptanceRules(
  report: ValidationReport,
  input: ValidationInputPayload,
  run: ExecutionResult,
): ValidationReport {
  const executionStatus = run.status;
  const expectedRaw = input.expectedOutput?.trim() ? input.expectedOutput : null;
  const actual = run.output;

  let matched = false;
  let reason: string;

  if (executionStatus === "error") {
    reason = "Code failed to execute, so the output could not be compared.";
  } else if (!expectedRaw) {
    reason = "No expected output was provided, so an exact match could not be verified.";
  } else {
    matched = compareOutputs(actual, expectedRaw);
    reason = matched
      ? "Actual output matches the expected output exactly."
      : "Actual output differs from the expected output.";
  }

  const verdict = executionStatus === "success" && matched ? "accepted" : "rejected";

  const fallbackComplexity = estimateComplexity(input.code, input.language);
  const fallbackScores = calculateFallbackScores(input.code, input.language, executionStatus, matched);
  const fallbackSuggestions = generateFallbackSuggestions(
    input.code,
    input.language,
    executionStatus,
    matched,
    expectedRaw,
    actual,
  );

  const finalComplexity = {
    time:
      report.complexity.time && report.complexity.time !== "Unknown"
        ? report.complexity.time
        : fallbackComplexity.time,
    space:
      report.complexity.space && report.complexity.space !== "Unknown"
        ? report.complexity.space
        : fallbackComplexity.space,
    timeExplanation: report.complexity.timeExplanation || fallbackComplexity.timeExplanation,
    spaceExplanation: report.complexity.spaceExplanation || fallbackComplexity.spaceExplanation,
  };

  const finalScores = {
    overall: report.scores.overall > 0 ? report.scores.overall : fallbackScores.overall,
    logic: report.scores.logic > 0 ? report.scores.logic : fallbackScores.logic,
    syntax: report.scores.syntax > 0 ? report.scores.syntax : fallbackScores.syntax,
    quality: report.scores.quality > 0 ? report.scores.quality : fallbackScores.quality,
    efficiency: report.scores.efficiency > 0 ? report.scores.efficiency : fallbackScores.efficiency,
    bestPractices: report.scores.bestPractices > 0 ? report.scores.bestPractices : fallbackScores.bestPractices,
    outputMatch: matched ? 100 : 0,
    readability: report.scores.readability > 0 ? report.scores.readability : fallbackScores.readability,
  };

  const fillCode = (existing: string, fallbackCode: string) =>
    existing && existing.trim() ? existing : fallbackCode;
  const fillText = (existing: string, fallbackText: string) =>
    existing && existing.trim() ? existing : fallbackText;
  const fillList = (existing: string[], fallbackList: string[]) =>
    existing && existing.length > 0 ? existing : fallbackList;

  const finalSuggestions = {
    cleaner: fillCode(report.suggestions.cleaner, fallbackSuggestions.cleaner),
    optimized: fillCode(report.suggestions.optimized, fallbackSuggestions.optimized),
    beginner: fillCode(report.suggestions.beginner, fallbackSuggestions.beginner),
    intermediate: fillCode(report.suggestions.intermediate, fallbackSuggestions.intermediate),
    advanced: fillCode(report.suggestions.advanced, fallbackSuggestions.advanced),
    production: fillCode(report.suggestions.production, fallbackSuggestions.production),
  };

  const finalAlternative = fillCode(report.alternativeSolution, fallbackSuggestions.alternativeSolution);
  const finalIndustry = fillCode(report.industryStandardSolution, fallbackSuggestions.industryStandardSolution);

  const finalQuestionUnderstanding = fillText(
    report.questionUnderstanding,
    `Evaluate ${input.language.toUpperCase()} solution against expected requirements and sample datasets.`,
  );
  const finalApproachUsed = fillText(
    report.approachUsed,
    `Sandboxed execution of submitted code and exact output comparison.`,
  );

  const defaultWhatIsWrong =
    verdict === "accepted"
      ? []
      : [
          executionStatus === "error"
            ? `Execution error: ${run.error}`
            : "Output mismatch: Actual output differs from expected output.",
        ];
  const defaultHowToFix =
    verdict === "accepted"
      ? []
      : [
          executionStatus === "error"
            ? "Fix execution error in query/code."
            : "Adjust query logic to match expected output rows/columns.",
        ];

  return {
    ...report,
    verdict,
    executionStatus,
    outputMatch: { matched, expected: expectedRaw, actual, reason },
    execution: {
      ...report.execution,
      output: actual,
      error: run.error,
      estimatedTimeMs: run.timeMs,
      note: run.note,
    },
    complexity: finalComplexity,
    scores: finalScores,
    questionUnderstanding: finalQuestionUnderstanding,
    approachUsed: finalApproachUsed,
    edgeCases: fillList(report.edgeCases, ["Validating sample data context and exact expected output match."]),
    whatIsWrong: fillList(report.whatIsWrong, defaultWhatIsWrong),
    howToFix: fillList(report.howToFix, defaultHowToFix),
    betterApproach: fillText(
      report.betterApproach,
      verdict === "accepted" ? "Solution produces exact expected output." : defaultHowToFix[0] || "Review code logic.",
    ),
    alternativeSolution: finalAlternative,
    industryStandardSolution: finalIndustry,
    suggestions: finalSuggestions,
    learning: {
      concepts: fillList(report.learning.concepts, [input.language.toUpperCase(), "Data Querying", "Output Formatting"]),
      bestPractices: fillList(report.learning.bestPractices, ["Verify table schemas and column names", "Test edge cases and NULL values"]),
      interviewTips: fillList(report.learning.interviewTips, ["Ensure output format and column ordering match expected results"]),
      interviewQuestions: fillList(report.learning.interviewQuestions, ["How would you optimize this solution for larger datasets?"]),
      commonMistakes: fillList(report.learning.commonMistakes, ["Missing table definitions or filter conditions"]),
    },
  };
}

