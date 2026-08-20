import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  createSubmission,
  getSubmission,
  listSubmissions,
  publishSubmission,
  submissionIdSchema,
} from "./submissions.server";

export const listSubmissionsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdminSession } = await import("./auth.server");
  await requireAdminSession();
  return listSubmissions();
});

export const getSubmissionFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => submissionIdSchema.parse(input))
  .handler(async ({ data }) => getSubmission(data.id));

export const createSubmissionFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input as any)
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./auth.server");
    await requireAdminSession();
    return createSubmission(data);
  });

export const publishSubmissionFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), adminNotes: z.string().optional() }).parse(input))
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./auth.server");
    await requireAdminSession();
    return publishSubmission(data.id, data.adminNotes);
  });

export const listMySubmissionsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuthSession } = await import("./auth.server");
  const session = await requireAuthSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("submissions")
    .select("*, employee_files(original_name)")
    .or(`employee_uuid.eq.${session.id},employee_code.eq.${session.employeeId}`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load submissions: ${error.message}`);
  // Only return submissions published by Admin
  return (data || []).filter((s: any) => s.is_published === true || s.report?.is_published !== false);
});

