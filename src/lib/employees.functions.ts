import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminSession } from "./auth.server";
import { DEPARTMENTS } from "./validation-types";

export const employeeInsertSchema = z.object({
  employee_id: z.string().min(1),
  name: z.string().min(1),
  department: z.enum(DEPARTMENTS as unknown as [string, ...string[]]),
  is_admin: z.boolean().default(false),
  access_status: z.boolean().default(true),
});

export const employeeUpdateSchema = employeeInsertSchema.extend({
  id: z.string().uuid(),
});

export const listEmployeesFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("employees").select("*").order("employee_id", { ascending: true });
  if (error) {
    console.error("[Fetch Employees Error]", error);
    throw new Error(`Failed to fetch employees: ${error.message}`);
  }
  return data;
});


export const createEmployeeFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => employeeInsertSchema.parse(input))
  .handler(async ({ data }) => {
    await requireAdminSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("employees").insert([data]);
    if (error) {
      console.error("[Create Employee Error]", error);
      throw new Error(`Failed to create employee: ${error.message}`);
    }
    return { success: true };
  });

export const updateEmployeeFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => employeeUpdateSchema.parse(input))
  .handler(async ({ data: { id, ...updates } }) => {
    await requireAdminSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("employees").update(updates).eq("id", id);
    if (error) throw new Error("Failed to update employee");
    return { success: true };
  });

export const deleteEmployeeFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdminSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("employees").delete().eq("id", data.id);
    if (error) throw new Error("Failed to delete employee");
    return { success: true };
  });
