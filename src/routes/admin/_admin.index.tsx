import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  FileText,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  TrendingUp,
  Play,
} from "lucide-react";
import { getAdminDashboardStatsFn } from "@/lib/admin-stats.functions";
import { toast } from "sonner";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/admin/_admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const getAdminStats = useServerFn(getAdminDashboardStatsFn);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getAdminStats();
        setStats(data);
      } catch (err: any) {
        toast.error("Failed to load admin dashboard stats");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Admin Analytics Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Real-time metrics, employee activity, file upload tracking, and validation statistics
        </p>
      </div>

      {/* Main KPI Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "--" : stats?.totalEmployees}</div>
            <p className="text-xs text-muted-foreground">
              {loading ? "" : `${stats?.activeEmployees} Active Employees`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "--" : stats?.totalFiles}</div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span className="text-amber-600 font-medium">{stats?.pendingValidations || 0} Pending</span>
              <span>•</span>
              <span className="text-green-600 font-medium">{stats?.completedValidations || 0} Completed</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "--" : stats?.totalSubmissions}</div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span className="text-green-600 font-medium">{stats?.totalCorrectQuestions || 0} Correct Qs</span>
              <span>•</span>
              <span className="text-destructive font-medium">{stats?.totalWrongQuestions || 0} Wrong Qs</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <Award className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "--" : `${stats?.averageScore}%`}</div>
            <p className="text-xs text-muted-foreground">Overall validation performance</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics & Quick Links */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">Pending Validations</p>
              <p className="text-2xl font-bold">{loading ? "--" : stats?.pendingValidations}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/files">Review Files</Link>
          </Button>
        </Card>

        <Card className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-green-500/10 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">Completed Validations</p>
              <p className="text-2xl font-bold">{loading ? "--" : stats?.completedValidations}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/files">View Completed</Link>
          </Button>
        </Card>

        <Card className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">Active Employees</p>
              <p className="text-2xl font-bold">{loading ? "--" : stats?.activeEmployees}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/employees">Manage</Link>
          </Button>
        </Card>
      </div>

      {/* Recent Uploads Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Recent Assessment Uploads</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/files">View All Files</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Upload Date/Time</TableHead>
                <TableHead>Validation Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6">
                    Loading recent uploads...
                  </TableCell>
                </TableRow>
              ) : stats?.recentFiles?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                    No uploaded files found.
                  </TableCell>
                </TableRow>
              ) : (
                stats?.recentFiles?.map((file: any) => {
                  const isValidated =
                    file.validation_status === "validated" ||
                    (Array.isArray(file.submissions) && file.submissions.length > 0);
                  return (
                    <TableRow key={file.id}>
                      <TableCell className="font-medium">
                        {file.employees?.name || "Unknown"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {file.employees?.employee_id || "N/A"}
                      </TableCell>
                      <TableCell>{file.employees?.department || "N/A"}</TableCell>
                      <TableCell className="font-medium truncate max-w-[180px]" title={file.original_name}>
                        {file.original_name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(file.created_at), "MMM d, yyyy h:mm a")}
                      </TableCell>
                      <TableCell>
                        {isValidated ? (
                          <div className="flex items-center gap-1.5 text-green-600 font-medium text-xs">
                            <CheckCircle2 className="h-4 w-4" />
                            Validated
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-amber-600 font-medium text-xs">
                            <Clock className="h-4 w-4" />
                            Pending
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" asChild className="gap-1.5">
                          <Link to="/admin/validate" search={{ fileId: file.id }}>
                            <Play className="h-3.5 w-3.5" />
                            Validate
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
