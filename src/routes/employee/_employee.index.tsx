import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Award,
  HelpCircle,
  User,
  Building,
  BadgeCheck,
  Eye,
  Upload,
} from "lucide-react";
import { getEmployeeStatsFn } from "@/lib/employee-stats.functions";
import { toast } from "sonner";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { scoreTone } from "@/lib/validation-types";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/employee/_employee/")({
  component: EmployeeDashboard,
});

function EmployeeDashboard() {
  const getStats = useServerFn(getEmployeeStatsFn);
  const { session } = Route.useRouteContext();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getStats();
        setStats(data);
      } catch (err: any) {
        toast.error("Failed to load employee dashboard stats");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      {/* Employee Profile Header Card */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-background to-background">
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">{session.name}</h2>
              <Badge variant="outline" className="font-mono text-xs">
                {session.employeeId}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building className="h-4 w-4" />
              <span>{session.department}</span>
              <span>•</span>
              <BadgeCheck className="h-4 w-4 text-green-600" />
              <span>Active Employee Account</span>
            </div>
          </div>
          <Button asChild className="gap-2">
            <Link to="/employee/upload">
              <Upload className="h-4 w-4" />
              Upload Assessment
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Main Employee KPI Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uploaded Files</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "--" : stats?.totalFiles}</div>
            <p className="text-xs text-muted-foreground">Total task documents uploaded</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Validations</CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "--" : stats?.pendingValidations}</div>
            <p className="text-xs text-muted-foreground">Awaiting Admin review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Validations</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "--" : stats?.completedValidations}</div>
            <p className="text-xs text-muted-foreground">Reviewed & published by Admin</p>
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

      {/* Secondary Question Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">Total Questions Evaluated</p>
              <p className="text-2xl font-bold">{loading ? "--" : stats?.totalQuestions}</p>
            </div>
          </div>
        </Card>

        <Card className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-green-500/10 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">Correct Questions</p>
              <p className="text-2xl font-bold">{loading ? "--" : stats?.correctQuestions}</p>
            </div>
          </div>
        </Card>

        <Card className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">Wrong Questions</p>
              <p className="text-2xl font-bold">{loading ? "--" : stats?.wrongQuestions}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Validation Results */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Recent Validation Results</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/employee/history">View Full History</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-4">Loading activity...</p>
          ) : stats?.recentSubmissions?.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No published validation results yet. Once an Admin reviews your uploaded files, your results will appear here.
            </p>
          ) : (
            <div className="space-y-4">
              {stats.recentSubmissions.map((sub: any) => (
                <div
                  key={sub.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none truncate max-w-[400px]">
                      {sub.employee_files?.original_name || sub.question}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Published: {format(new Date(sub.created_at), "MMM d, yyyy h:mm a")} • {sub.language.toUpperCase()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        scoreTone(sub.overall_score) === "success"
                          ? "default"
                          : scoreTone(sub.overall_score) === "warning"
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {sub.overall_score}% Marks
                    </Badge>
                    <Button variant="outline" size="sm" asChild className="gap-1.5">
                      <Link to="/history/$id" params={{ id: sub.id }}>
                        <Eye className="h-3.5 w-3.5" />
                        View Report
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
