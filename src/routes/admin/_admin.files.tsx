import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAllFilesFn } from "@/lib/files.functions";
import { toast } from "sonner";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Play } from "lucide-react";

export const Route = createFileRoute("/admin/_admin/files")({
  component: AdminFiles,
});

function AdminFiles() {
  const listFiles = useServerFn(listAllFilesFn);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await listFiles();
        setFiles(data || []);
      } catch (err: any) {
        toast.error(err.message || "Failed to load files");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Admin Task Documents & System Files</h2>
          <p className="text-sm text-muted-foreground">
            Assessment files and task reference documents uploaded for Code Pilot task assignments
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/admin/submissions">View Employee Submissions →</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee Name</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>File Name</TableHead>
                <TableHead>File Type</TableHead>
                <TableHead>Upload Date/Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Validation Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-6">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : files.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                    No files uploaded yet.
                  </TableCell>
                </TableRow>
              ) : (
                files.map((file) => {
                  const hasSubmissions = Array.isArray(file.submissions) && file.submissions.length > 0;
                  const isValidated = file.validation_status === "validated" || hasSubmissions;
                  return (
                    <TableRow key={file.id}>
                      <TableCell className="font-medium">
                        {file.employees?.name || "Unknown"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {file.employees?.employee_id || "N/A"}
                      </TableCell>
                      <TableCell>
                        {file.employees?.department || "N/A"}
                      </TableCell>
                      <TableCell className="font-medium truncate max-w-[180px]" title={file.original_name}>
                        {file.original_name}
                      </TableCell>
                      <TableCell className="text-xs uppercase font-mono">
                        {file.file_type?.split("/").pop()?.replace("vnd.openxmlformats-officedocument.wordprocessingml.document", "docx") || file.file_type || "N/A"}
                      </TableCell>
                      <TableCell>
                        {format(new Date(file.created_at), "MMM d, yyyy h:mm a")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs">
                          Uploaded
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isValidated ? (
                          <div className="flex items-center gap-1.5 text-green-600 font-medium text-xs">
                            <CheckCircle2 className="h-4 w-4" />
                            Validated by Admin
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-amber-600 font-medium text-xs">
                            <Clock className="h-4 w-4" />
                            Pending Admin Validation
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={isValidated ? "outline" : "default"}
                          asChild
                          className="gap-1.5"
                        >
                          <Link to="/admin/validate" search={{ fileId: file.id }}>
                            <Play className="h-3.5 w-3.5" />
                            {isValidated ? "Re-validate" : "Validate File"}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

