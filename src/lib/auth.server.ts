import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { z } from "zod";

const SESSION_COOKIE_NAME = "employee_session";
// Note: In production this would be encrypted or signed securely using a library like `iron-session` or `jose`.
// For this standalone internal portal, we'll store a JSON payload.

export const sessionSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string(),
  name: z.string(),
  department: z.string(),
  isAdmin: z.boolean(),
});

export type SessionPayload = z.infer<typeof sessionSchema>;

export async function setAuthSession(session: SessionPayload) {
  setCookie(SESSION_COOKIE_NAME, JSON.stringify(session), {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });
}

export async function getAuthSession(): Promise<SessionPayload | null> {
  const cookie = getCookie(SESSION_COOKIE_NAME);
  if (!cookie) return null;

  try {
    const payload = JSON.parse(cookie);
    const result = sessionSchema.safeParse(payload);
    if (result.success) {
      return result.data;
    }
  } catch {
    // invalid json
  }
  return null;
}

export async function requireAuthSession(): Promise<SessionPayload> {
  const session = await getAuthSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireAdminSession(): Promise<SessionPayload> {
  const session = await requireAuthSession();
  if (!session.isAdmin) {
    throw new Error("Forbidden: Admin access required");
  }
  return session;
}

export async function destroyAuthSession() {
  deleteCookie(SESSION_COOKIE_NAME, {
    path: "/",
  });
}
