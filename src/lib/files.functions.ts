import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminSession, requireAuthSession } from "./auth.server";

export const listAllFilesFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("employee_files")
    .select("*, employees(name, employee_id, department), submissions(id, verdict)")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching all files for admin:", error);
    throw new Error(`Failed to fetch files: ${error.message || "Database error"}`);
  }
  return data;
});

export const listMyFilesFn = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireAuthSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("employee_files")
    .select("*, submissions(*)")
    .eq("employee_uuid", session.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching employee files:", error);
    throw new Error(`Failed to fetch files: ${error.message || "Database error"}`);
  }
  return data;
});

export const getUploadUrlFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ filename: z.string(), contentType: z.string() }).parse(input))
  .handler(async ({ data: { filename, contentType } }) => {
    const session = await requireAuthSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${session.id}/${Date.now()}_${filename}`;
    
    // We can just use standard Supabase client to upload from browser if we have a session, 
    // but to be secure without RLS, we generate a signed upload URL or we handle upload here.
    // Given the constraints, let's create a signed upload URL from admin client.
    
    const { data, error } = await supabaseAdmin.storage.from("assessments").createSignedUploadUrl(path);
    if (error) {
      console.error("Storage permission or URL creation error:", error);
      throw new Error(`File upload failed: storage permission denied (${error.message || "Signed URL failed"})`);
    }
    
    return { signedUrl: data.signedUrl, path, token: data.token };
  });

export const getFileFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data: { id } }) => {
    await requireAdminSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("employee_files")
      .select("*, employees(name, employee_id, department)")
      .eq("id", id)
      .single();
    if (error || !data) throw new Error("File not found");

    let fileUrl = "";
    try {
      const { data: signedData } = await supabaseAdmin.storage
        .from("assessments")
        .createSignedUrl(data.file_path, 3600);
      if (signedData?.signedUrl) {
        fileUrl = signedData.signedUrl;
      }
    } catch (e) {
      console.error("Failed to generate signed URL for storage file", e);
    }

    let textContent = "";
    let docxHtml = "";
    let fileDataUrl = "";
    const ext = (data.original_name || "").split(".").pop()?.toLowerCase();
    const isDocx =
      ext === "docx" ||
      data.file_type?.toLowerCase().includes("word") ||
      data.file_type?.toLowerCase().includes("officedocument");
    const isPdf = ext === "pdf" || data.file_type?.toLowerCase().includes("pdf");

    try {
      const { data: fileData, error: downloadErr } = await supabaseAdmin.storage
        .from("assessments")
        .download(data.file_path);
      if (!downloadErr && fileData) {
        const buffer = await fileData.arrayBuffer();
        if (isDocx) {
          try {
            const mammoth = await import("mammoth");
            const rawRes = await mammoth.extractRawText({ arrayBuffer: buffer });
            const htmlRes = await mammoth.convertToHtml({ arrayBuffer: buffer });
            textContent = rawRes.value || "";
            docxHtml = htmlRes.value || "";
          } catch (mErr) {
            console.error("Server-side mammoth DOCX extraction error:", mErr);
          }
          const base64 = Buffer.from(buffer).toString("base64");
          fileDataUrl = `data:${
            data.file_type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          };base64,${base64}`;
        } else if (!isPdf) {
          textContent = new TextDecoder().decode(buffer);
        }
      }
    } catch (e) {
      console.error("Failed to read storage file content", e);
    }

    return { ...data, fileUrl: fileDataUrl || fileUrl, fileDataUrl, textContent, docxHtml };
  });

export const recordFileFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ 
    original_name: z.string(), 
    file_type: z.string(), 
    file_size: z.number().max(50 * 1024 * 1024), 
    file_path: z.string() 
  }).parse(input))
  .handler(async ({ data }) => {
    const session = await requireAuthSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: record, error } = await supabaseAdmin
      .from("employee_files")
      .insert([{
        employee_uuid: session.id,
        original_name: data.original_name,
        file_type: data.file_type,
        file_size: data.file_size,
        file_path: data.file_path,
      }])
      .select("id")
      .single();
    if (error) {
      console.error("Database record error for employee file:", error);
      throw new Error(`File upload failed: database record could not be created (${error.message || "Database insert failed"})`);
    }
    return { success: true, id: record.id };
  });


