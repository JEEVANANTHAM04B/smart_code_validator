import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ValidatorCore } from "@/components/validator-core";
import { getTaskAssignmentDetailsFn } from "@/lib/tasks.functions";
import { getSessionFn } from "@/lib/auth.functions";
import type { Language } from "@/lib/validation-types";

const searchSchema = z.object({
  assignmentId: z.string().optional(),
  taskId: z.string().optional(),
});

export const Route = createFileRoute("/validator")({
  validateSearch: (search) => searchSchema.parse(search),
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
      { title: "Code Validator | Smart Code Validator" },
      {
        name: "description",
        content:
          "Submit a Python or SQL solution and get an AI code review with scores, complexity analysis, difficulty estimation and optimized rewrites.",
      },
      { property: "og:title", content: "Code Validator | Smart Code Validator" },
      {
        property: "og:description",
        content: "AI code review with scoring, complexity analysis and optimized solutions.",
      },
    ],
  }),
  component: ValidatorPage,
});

function ValidatorPage() {
  const { assignmentId } = Route.useSearch();
  const context = Route.useRouteContext();
  const session = context?.session;

  const getTaskAssignmentDetails = useServerFn(getTaskAssignmentDetailsFn);
  const [taskData, setTaskData] = useState<any>(null);
  const [loading, setLoading] = useState(!!assignmentId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assignmentId) return;
    let isMounted = true;
    setLoading(true);
    setError(null);

    getTaskAssignmentDetails({ data: { assignmentId } })
      .then((data) => {
        if (isMounted) {
          setTaskData(data);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to load task details. Please refresh and try again.");
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [assignmentId]);

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading assigned task details...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-destructive font-medium">
        {error}
      </div>
    );
  }

  const task = taskData?.task;

  return (
    <ValidatorCore
      assignmentId={assignmentId}
      fixedEmployeeName={session?.name || undefined}
      fixedEmployeeCode={session?.employeeId || undefined}
      fixedDepartment={session?.department || undefined}
      employeeUuid={session?.id || undefined}
      initialQuestion={task ? `${task.title}\n\n${task.description}` : undefined}
      initialExpectedOutput={task?.expected_output || undefined}
      initialLanguage={(task?.language as Language) || undefined}
      documentName={task?.document?.original_name || undefined}
    />
  );
}

