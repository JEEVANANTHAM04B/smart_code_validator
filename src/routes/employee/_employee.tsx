import { createFileRoute, redirect, Outlet, Link } from "@tanstack/react-router";
import { getSessionFn, logoutFn } from "@/lib/auth.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, Upload, CheckSquare, History } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@tanstack/react-router";

import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/employee/_employee")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session) {
      throw redirect({ to: "/employee/login" });
    }
    return { session };
  },
  component: EmployeeLayout,
});

function EmployeeLayout() {
  const { session } = Route.useRouteContext();
  const logout = useServerFn(logoutFn);
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out");
    router.navigate({ to: "/employee/login" });
  };

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-3">
          <BrandLogo className="h-9 w-9" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Employee Portal</h1>
            <p className="text-muted-foreground">Welcome back, {session.name}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        <Button variant="ghost" asChild className="gap-2">
          <Link
            to="/employee"
            activeProps={{ className: "bg-accent text-accent-foreground" }}
            activeOptions={{ exact: true }}
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
        </Button>
        <Button variant="ghost" asChild className="gap-2">
          <Link
            to="/employee/upload"
            activeProps={{ className: "bg-accent text-accent-foreground" }}
          >
            <Upload className="h-4 w-4" />
            Upload Task
          </Link>
        </Button>
        <Button variant="ghost" asChild className="gap-2">
          <Link
            to="/employee/history"
            activeProps={{ className: "bg-accent text-accent-foreground" }}
          >
            <History className="h-4 w-4" />
            My History
          </Link>
        </Button>

      </div>

      <div className="pt-4">
        <Outlet />
      </div>
    </div>
  );
}
