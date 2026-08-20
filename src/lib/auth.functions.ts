import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { setAuthSession, destroyAuthSession, getAuthSession } from "./auth.server";

export const loginSchema = z.object({
  employeeId: z.string().min(1),
  name: z.string().min(1),
});

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => loginSchema.parse(input))
  .handler(async ({ data }) => {
    console.log("Attempting login with:", data.employeeId, data.name);
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: employee, error } = await supabase
      .rpc("authenticate_employee", {
        p_employee_id: data.employeeId,
        p_name: data.name
      });
      
    console.log("RPC Result:", { employee, error });

    if (error || !employee) {
      console.error("[Login Error]", error);
      throw new Error(`Invalid Employee ID or Employee Name. ${error ? 'DB Error: ' + error.message : ''}`);
    }

    const emp = (Array.isArray(employee) ? employee[0] : employee) as any;

    if (!emp || !emp.access_status) {
      throw new Error("Access denied. Your account is disabled.");
    }

    await setAuthSession({
      id: emp.id,
      employeeId: emp.employee_id,
      name: emp.name,
      department: emp.department,
      isAdmin: emp.is_admin,
    });

    return { success: true, isAdmin: emp.is_admin };

  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  await destroyAuthSession();
  return { success: true };
});

export const getSessionFn = createServerFn({ method: "GET" }).handler(async () => {
  return await getAuthSession();
});
