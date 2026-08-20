import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadCloud, File, Loader2 } from "lucide-react";
import { getUploadUrlFn, recordFileFn } from "@/lib/files.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/employee/_employee/upload")({
  component: EmployeeUpload,
});

function EmployeeUpload() {
  const navigate = useNavigate();
  const getUploadUrl = useServerFn(getUploadUrlFn);
  const recordFile = useServerFn(recordFileFn);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB limit

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
        toast.error("File size exceeds maximum allowed limit of 50 MB.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        setFile(null);
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error("File size exceeds maximum allowed limit of 50 MB.");
      return;
    }
    setIsUploading(true);
    try {
      // 1. Get signed URL
      const { signedUrl, path } = await getUploadUrl({
        data: { filename: file.name, contentType: file.type || "application/octet-stream" },
      });

      // 2. Upload file via signed URL
      const res = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error("Storage PUT error:", res.status, res.statusText, errText);
        throw new Error(`File upload failed: storage permission denied (${res.statusText || res.status})`);
      }

      // 3. Record file in database
      const result = await recordFile({
        data: {
          original_name: file.name,
          file_type: file.type || file.name.split(".").pop()?.toUpperCase() || "Unknown",
          file_size: file.size,
          file_path: path,
        },
      });

      toast.success("File uploaded successfully.");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      
      // Navigate to validation/history
      navigate({ to: "/employee/history" });

    } catch (err: any) {
      console.error("Upload error details:", err);
      toast.error(err.message || "File upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold">Upload Assessment</h2>
        <p className="text-sm text-muted-foreground">Upload your task or assessment document to link it with your validation.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select File</CardTitle>
          <CardDescription>Supported formats: PDF, DOCX, TXT, PY, SQL</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div 
            className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileChange}
              accept=".pdf,.docx,.txt,.py,.sql"
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <div className="p-3 bg-primary/10 rounded-full">
                  <File className="w-8 h-8 text-primary" />
                </div>
                <p className="font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{Math.round(file.size / 1024)} KB</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <UploadCloud className="w-10 h-10 mb-2" />
                <p className="font-medium">Click to browse or drag and drop</p>
                <p className="text-xs">Max file size: 50MB</p>
              </div>
            )}
          </div>
          
          <Button 
            className="w-full" 
            disabled={!file || isUploading} 
            onClick={handleUpload}
          >
            {isUploading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
            ) : (
              "Upload and Continue to Validation"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
