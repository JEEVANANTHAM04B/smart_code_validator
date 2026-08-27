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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Employee Management</h2>
          <p className="text-sm text-muted-foreground">Manage employee access to the portal</p>
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

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">S.No</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6">Loading...</TableCell></TableRow>
              ) : employees.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No employees found.</TableCell></TableRow>
              ) : (
                employees.map((emp, index) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium">{emp.employee_id}</TableCell>
                    <TableCell>{emp.name}</TableCell>
                    <TableCell>{emp.department}</TableCell>
                    <TableCell>{emp.is_admin ? "Admin" : "Employee"}</TableCell>
                    <TableCell>
                      {emp.access_status ? (
                        <span className="text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full text-xs">Active</span>
                      ) : (
                        <span className="text-red-600 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-full text-xs">Disabled</span>
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
                ))
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
