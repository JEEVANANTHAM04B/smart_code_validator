import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ValidatorCore } from "@/components/validator-core";
import { getFileFn } from "@/lib/files.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const searchSchema = z.object({
  fileId: z.string().optional(),
});

export const Route = createFileRoute("/admin/_admin/validate")({
  validateSearch: (search) => searchSchema.parse(search),
  component: AdminValidatePage,
});

function AdminValidatePage() {
  const { fileId } = Route.useSearch();
  const navigate = useNavigate();
  const getFile = useServerFn(getFileFn);
  const [fileDetails, setFileDetails] = useState<any>(null);
  const [loading, setLoading] = useState(!!fileId);

  useEffect(() => {
    if (!fileId) return;
    async function loadFile() {
      try {
        const data = await getFile({ data: { id: fileId } });
        setFileDetails(data);
      } catch (err: any) {
        toast.error("Failed to load file for validation");
      } finally {
        setLoading(false);
      }
    }
    loadFile();
  }, [fileId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12 text-sm text-muted-foreground gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Loading uploaded file content...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/admin/files" })} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Uploaded Files
        </Button>
      </div>

      <ValidatorCore
        fixedEmployeeName={fileDetails?.employees?.name ?? undefined}
        fixedEmployeeCode={fileDetails?.employees?.employee_id ?? undefined}
        fixedDepartment={fileDetails?.employees?.department ?? undefined}
        employeeUuid={fileDetails?.employee_uuid ?? undefined}
        fileId={fileId ?? undefined}
        documentName={fileDetails?.original_name ?? undefined}
        documentContent={fileDetails?.textContent ?? undefined}
        docxHtml={fileDetails?.docxHtml ?? undefined}
        fileUrl={fileDetails?.fileUrl ?? undefined}
        fileType={fileDetails?.file_type ?? undefined}
        initialQuestion={fileDetails?.original_name ? `Question 1 from ${fileDetails.original_name}` : undefined}
        // Do NOT set initialCode with full textContent — code editor stays clean per Requirement 2!
        initialCode=""
        onHistoryClick={() => navigate({ to: "/admin/submissions" })}
      />
    </div>
  );
}
