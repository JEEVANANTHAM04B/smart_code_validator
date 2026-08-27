import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DEPARTMENTS } from "@/lib/validation-types";
import { listEmployeesFn } from "@/lib/employees.functions";
import { createTaskFn, listAdminTasksFn } from "@/lib/tasks.functions";
import { uploadFileFn } from "@/lib/files.functions";
import { toast } from "sonner";
import { Plus, CheckSquare, FileText, Users, Eye } from "lucide-react";

export const Route = createFileRoute("/admin/_admin/tasks")({
  component: AdminTasksPage,
});

function AdminTasksPage() {
  const listAdminTasks = useServerFn(listAdminTasksFn);
  const listEmployees = useServerFn(listEmployeesFn);
  const createTask = useServerFn(createTaskFn);
  const uploadFile = useServerFn(uploadFileFn);

  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [isViewDetailsOpen, setIsViewDetailsOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [language, setLanguage] = useState<"python" | "sql">("python");
  const [expectedOutput, setExpectedOutput] = useState("");
  const [requirements, setRequirements] = useState("");
  const [validationCriteria, setValidationCriteria] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>("ALL");
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [taskDocument, setTaskDocument] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tData, eData] = await Promise.all([listAdminTasks(), listEmployees()]);
      setTasks(tData || []);
      setEmployees(eData || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load task data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredEmployees = employees.filter((e) => {
    if (e.is_admin) return false;
    if (selectedDeptFilter === "ALL") return true;
    return e.department === selectedDeptFilter;
  });

  const handleSelectDepartmentEmployees = (dept: string, checked: boolean) => {
    const deptEmpIds = employees
      .filter((e) => !e.is_admin && (dept === "ALL" || e.department === dept))
      .map((e) => e.id);

    if (checked) {
      setSelectedEmpIds((prev) => Array.from(new Set([...prev, ...deptEmpIds])));
    } else {
      setSelectedEmpIds((prev) => prev.filter((id) => !deptEmpIds.includes(id)));
    }
  };

  const handleToggleEmployee = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedEmpIds((prev) => [...prev, id]);
    } else {
      setSelectedEmpIds((prev) => prev.filter((eId) => eId !== id));
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required");
      return;
    }
    if (selectedEmpIds.length === 0) {
      toast.error("Please select at least one employee to assign the task");
      return;
    }

    setIsSubmitting(true);
    try {
      let documentId: string | undefined = undefined;

      // Handle optional task document upload
      if (taskDocument) {
        if (taskDocument.size > 50 * 1024 * 1024) {
          throw new Error("Task document exceeds maximum 50 MB size limit.");
        }
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const res = reader.result as string;
            resolve(res.split(",")[1] || res);
          };
          reader.onerror = reject;
          reader.readAsDataURL(taskDocument);
        });

        const uploaded = await uploadFile({
          data: {
            fileName: taskDocument.name,
            fileType: taskDocument.type || "application/octet-stream",
            fileSize: taskDocument.size,
            base64Data: base64,
          },
        });
        documentId = uploaded.id;
      }

      await createTask({
        data: {
          title,
          description,
          instructions,
          document_id: documentId,
          language,
          expected_output: expectedOutput,
          requirements,
          validation_criteria: validationCriteria,
          employee_uuids: selectedEmpIds,
        },
      });

      toast.success("Task published successfully and assigned to selected employees!");
      setIsCreateOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to publish task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setInstructions("");
    setLanguage("python");
    setExpectedOutput("");
    setRequirements("");
    setValidationCriteria("");
    setSelectedEmpIds([]);
    setTaskDocument(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Task Management</h2>
          <p className="text-sm text-muted-foreground">
            Create, assign, and track automated employee assessments by department
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Create Assessment Task
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Published Assessment Tasks</CardTitle>
          <CardDescription>
            System automatically validates employee submissions based on your criteria
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task Title</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Not Started</TableHead>
                <TableHead>In Progress</TableHead>
                <TableHead>Attempted</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-6">
                    Loading tasks...
                  </TableCell>
                </TableRow>
              ) : tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                    No tasks created yet. Click "Create Assessment Task" to publish your first task.
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">
                      <div>
                        <p className="font-semibold">{task.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{task.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="uppercase font-mono">
                        {task.language}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">{task.stats.totalAssigned}</TableCell>
                    <TableCell className="text-muted-foreground">{task.stats.notStarted}</TableCell>
                    <TableCell className="text-blue-600">{task.stats.inProgress}</TableCell>
                    <TableCell className="text-yellow-600">{task.stats.attempted}</TableCell>
                    <TableCell className="text-green-600">{task.stats.completed}</TableCell>
                    <TableCell className="text-emerald-600 font-bold">{task.stats.submitted}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedTask(task);
                          setIsViewDetailsOpen(true);
                        }}
                        className="gap-1.5"
                      >
                        <Eye className="w-4 h-4" /> View Progress
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Task Creation Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create & Assign Assessment Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-5 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="taskTitle">Task Title *</Label>
                <Input
                  id="taskTitle"
                  required
                  placeholder="e.g. Python Data Processing & SQL Joins Assessment"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Programming Language *</Label>
                <Select
                  value={language}
                  onValueChange={(val: "python" | "sql") => setLanguage(val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="python">Python</SelectItem>
                    <SelectItem value="sql">SQL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Task Document (Optional, Max 50MB)</Label>
                <Input
                  type="file"
                  accept=".pdf,.docx,.txt,.py,.sql"
                  onChange={(e) => setTaskDocument(e.target.files?.[0] || null)}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Problem / Question Description *</Label>
                <Textarea
                  required
                  rows={3}
                  placeholder="Enter detailed question prompt and problem statement..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Task Instructions (Optional)</Label>
                <Textarea
                  rows={2}
                  placeholder="Special instructions for employees..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Expected Output / Result (Optional)</Label>
                <Textarea
                  rows={3}
                  className="font-mono text-sm"
                  placeholder="Paste exact expected stdout or SQL result table grid..."
                  value={expectedOutput}
                  onChange={(e) => setExpectedOutput(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Task Requirements (Optional)</Label>
                <Input
                  placeholder="e.g. Use JOINs and aggregate functions"
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Validation Criteria (Optional)</Label>
                <Input
                  placeholder="e.g. Must execute cleanly and match expected output"
                  value={validationCriteria}
                  onChange={(e) => setValidationCriteria(e.target.value)}
                />
              </div>
            </div>

            {/* Department & Employee Assignment Section */}
            <div className="space-y-3 pt-3 border-t">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div>
                  <h4 className="font-semibold text-sm">Assign to Employees</h4>
                  <p className="text-xs text-muted-foreground">
                    Select department filter or check specific employees
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Department Filter:</span>
                  <Select
                    value={selectedDeptFilter}
                    onValueChange={(val) => setSelectedDeptFilter(val)}
                  >
                    <SelectTrigger className="w-[180px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Departments</SelectItem>
                      {DEPARTMENTS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Department Quick Select Buttons */}
              <div className="flex flex-wrap gap-2 py-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelectDepartmentEmployees(selectedDeptFilter, true)}
                  className="text-xs h-7"
                >
                  Select All ({selectedDeptFilter === "ALL" ? "All" : selectedDeptFilter})
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSelectDepartmentEmployees(selectedDeptFilter, false)}
                  className="text-xs h-7"
                >
                  Deselect All
                </Button>
              </div>

              {/* Employee Selection List */}
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2 bg-muted/20">
                {filteredEmployees.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    No employees found in selected department.
                  </p>
                ) : (
                  filteredEmployees.map((emp) => {
                    const isChecked = selectedEmpIds.includes(emp.id);
                    return (
                      <div
                        key={emp.id}
                        className="flex items-center justify-between space-x-2 py-1 px-2 rounded hover:bg-muted/50"
                      >
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`emp-${emp.id}`}
                            checked={isChecked}
                            onCheckedChange={(checked) =>
                              handleToggleEmployee(emp.id, Boolean(checked))
                            }
                          />
                          <label
                            htmlFor={`emp-${emp.id}`}
                            className="text-sm cursor-pointer font-medium leading-none"
                          >
                            {emp.name}{" "}
                            <span className="text-xs text-muted-foreground font-mono">
                              ({emp.employee_id})
                            </span>
                          </label>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {emp.department}
                        </Badge>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Selected Count Preview */}
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Selected: <strong className="text-foreground">{selectedEmpIds.length}</strong> employee(s)</span>
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-2 border-t">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Publishing Task..." : "Publish & Assign Task"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Task Progress & Individual Details Modal */}
      {selectedTask && (
        <Dialog open={isViewDetailsOpen} onOpenChange={setIsViewDetailsOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Progress Details: {selectedTask.title}</DialogTitle>
              <DialogDescription>
                Individual employee progress and completion status
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-center">
                <div className="p-3 bg-muted/40 rounded-lg">
                  <p className="text-xs text-muted-foreground">Assigned</p>
                  <p className="text-xl font-bold">{selectedTask.stats.totalAssigned}</p>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg">
                  <p className="text-xs text-muted-foreground">Not Started</p>
                  <p className="text-xl font-bold text-muted-foreground">{selectedTask.stats.notStarted}</p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <p className="text-xs text-blue-600 dark:text-blue-400">In Progress</p>
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{selectedTask.stats.inProgress}</p>
                </div>
                <div className="p-3 bg-yellow-500/10 rounded-lg">
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">Attempted</p>
                  <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{selectedTask.stats.attempted}</p>
                </div>
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <p className="text-xs text-green-600 dark:text-green-400">Completed</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">{selectedTask.stats.completed}</p>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-lg">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Submitted</p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{selectedTask.stats.submitted}</p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee Name</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Completed Date</TableHead>
                    <TableHead>Submitted Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(selectedTask.task_assignments || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                        No employees assigned to this task.
                      </TableCell>
                    </TableRow>
                  ) : (
                    selectedTask.task_assignments.map((assign: any) => (
                      <TableRow key={assign.id}>
                        <TableCell className="font-medium">
                          {assign.employee?.name || "Unknown"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {assign.employee?.employee_id || "N/A"}
                        </TableCell>
                        <TableCell>{assign.employee?.department || "N/A"}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              assign.status === "Submitted"
                                ? "bg-emerald-500/15 text-emerald-600"
                                : assign.status === "Completed"
                                ? "bg-green-500/15 text-green-600"
                                : assign.status === "Attempted"
                                ? "bg-yellow-500/15 text-yellow-600"
                                : assign.status === "In Progress"
                                ? "bg-blue-500/15 text-blue-600"
                                : "bg-muted text-muted-foreground"
                            }
                          >
                            {assign.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {assign.completed_at
                            ? new Date(assign.completed_at).toLocaleString()
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {assign.submitted_at
                            ? new Date(assign.submitted_at).toLocaleString()
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
