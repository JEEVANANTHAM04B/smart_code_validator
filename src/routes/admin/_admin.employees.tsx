import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DEPARTMENTS } from "@/lib/validation-types";
import { listEmployeesFn, createEmployeeFn, updateEmployeeFn, deleteEmployeeFn } from "@/lib/employees.functions";
import { toast } from "sonner";
import { Plus, Pencil, Trash } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/_admin/employees")({
  component: AdminEmployees,
});

function AdminEmployees() {
  const listEmployees = useServerFn(listEmployeesFn);
  const createEmployee = useServerFn(createEmployeeFn);
  const updateEmployee = useServerFn(updateEmployeeFn);
  const deleteEmployee = useServerFn(deleteEmployeeFn);

  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    employee_id: "",
    name: "",
    department: DEPARTMENTS[0] as string,
    access_status: true,
    is_admin: false,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await listEmployees();
      const sorted = (data || []).sort((a: any, b: any) =>
        a.employee_id.localeCompare(b.employee_id, undefined, { numeric: true, sensitivity: "base" })
      );
      setEmployees(sorted);
    } catch (e: any) {
      toast.error(e.message || "Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenNew = () => {
    setEditingId(null);
    setFormData({
      employee_id: "",
      name: "",
      department: DEPARTMENTS[0],
      access_status: true,
      is_admin: false,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (emp: any) => {
    setEditingId(emp.id);
    setFormData({
      employee_id: emp.employee_id,
      name: emp.name,
      department: emp.department,
      access_status: emp.access_status,
      is_admin: emp.is_admin,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateEmployee({ data: { id: editingId, ...formData } });
        toast.success("Employee updated");
      } else {
        await createEmployee({ data: formData });
        toast.success("Employee created");
      }
      setIsDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Operation failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this employee?")) return;
    try {
      await deleteEmployee({ data: { id } });
      toast.success("Employee deleted");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete employee");
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [activityFilter, setActivityFilter] = useState("ALL");

  const filteredEmployeesList = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employee_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = deptFilter === "ALL" || emp.department === deptFilter;
    const isInactive = emp.consecutive_missed >= 2;
    const matchesActivity =
      activityFilter === "ALL" ||
      (activityFilter === "Active" && !isInactive) ||
      (activityFilter === "Inactive" && isInactive);
    return matchesSearch && matchesDept && matchesActivity;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold">Employee Management</h2>
          <p className="text-sm text-muted-foreground">Manage employee access, department assignment, and activity tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={async () => {
            try {
              const { exportEmployeeListCsvFn } = await import("@/lib/tasks.functions");
              const { csvContent } = await exportEmployeeListCsvFn();
              const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.setAttribute("download", `employee-list-${new Date().toISOString().slice(0, 10)}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              toast.success("Employee list exported");
            } catch (err: any) {
              toast.error(err.message || "Failed to export employee list");
            }
          }} className="gap-2">
            Download Employee List
          </Button>
          <Button onClick={handleOpenNew} className="gap-2">
            <Plus className="w-4 h-4" /> Add Employee
          </Button>
        </div>
      </div>

      {/* Search & Filters Header */}
      <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-3 rounded-lg border">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search by name or employee ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 text-xs"
          />
        </div>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-[180px] h-9 text-xs">
            <SelectValue placeholder="Department Filter" />
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

        <Select value={activityFilter} onValueChange={setActivityFilter}>
          <SelectTrigger className="w-[160px] h-9 text-xs">
            <SelectValue placeholder="Activity Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive (2 Missed Rule)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">S.No</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Activity (2 Missed Rule)</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-6">Loading...</TableCell></TableRow>
              ) : filteredEmployeesList.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">No employees match your search filter.</TableCell></TableRow>
              ) : (
                filteredEmployeesList.map((emp, index) => {
                  const isInactive = emp.consecutive_missed >= 2;
                  return (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="font-medium font-mono">{emp.employee_id}</TableCell>
                      <TableCell>{emp.name}</TableCell>
                      <TableCell>{emp.department}</TableCell>
                      <TableCell>{emp.is_admin ? "Admin" : "Employee"}</TableCell>
                      <TableCell>
                        {emp.access_status ? (
                          <span className="text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full text-xs font-medium">Active</span>
                        ) : (
                          <span className="text-red-600 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full text-xs font-medium">Disabled</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isInactive ? (
                          <span className="text-destructive bg-destructive/10 px-2 py-0.5 rounded-full text-xs font-semibold" title="Missed 2 consecutive assigned assessments">
                            Inactive ({emp.consecutive_missed || 2} Missed)
                          </span>
                        ) : (
                          <span className="text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full text-xs font-medium">
                            Active ({emp.consecutive_missed || 0} Missed)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(emp)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(emp.id)}>
                          <Trash className="w-4 h-4" />
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Employee" : "Add Employee"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Employee ID</Label>
              <Input required value={formData.employee_id} onChange={e => setFormData({ ...formData, employee_id: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={formData.department} onValueChange={v => setFormData({ ...formData, department: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Admin Privileges</Label>
              <Switch checked={formData.is_admin} onCheckedChange={c => setFormData({ ...formData, is_admin: c })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Account Active</Label>
              <Switch checked={formData.access_status} onCheckedChange={c => setFormData({ ...formData, access_status: c })} />
            </div>
            <div className="pt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
