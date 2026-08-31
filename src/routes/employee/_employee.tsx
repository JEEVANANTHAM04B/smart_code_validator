import { createFileRoute, redirect, Outlet, Link } from "@tanstack/react-router";
import { getSessionFn, logoutFn } from "@/lib/auth.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, Upload, CheckSquare, History } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@tanstack/react-router";

import { BrandLogo } from "@/components/brand-logo";

import { useState, useEffect } from "react";
import { Bell, ArrowRight } from "lucide-react";
import { listNotificationsFn, markNotificationReadFn } from "@/lib/tasks.functions";

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
  const listNotifications = useServerFn(listNotificationsFn);
  const markRead = useServerFn(markNotificationReadFn);
  const router = useRouter();

  const [unreadNotifications, setUnreadNotifications] = useState<any[]>([]);

  const loadNotifications = async () => {
    try {
      const data = await listNotifications();
      setUnreadNotifications((data || []).filter((n: any) => !n.is_read));
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out");
    router.navigate({ to: "/employee/login" });
  };

  const handleDismissNotification = async (id: string) => {
    try {
      await markRead({ data: { notificationId: id } });
      setUnreadNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // Ignore
    }
  };

  return (
    <div className="flex flex-col space-y-6">
      {/* In-App Webpage Notification Bar */}
      {unreadNotifications.length > 0 && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-3.5 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Bell className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">New Task Assigned!</p>
              <p className="text-xs text-muted-foreground">
                {unreadNotifications[0]?.message || "You have a new assessment task waiting."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                handleDismissNotification(unreadNotifications[0].id);
                router.navigate({ to: "/employee/tasks" });
              }}
              className="gap-1.5 text-xs"
            >
              View Assigned Tasks <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

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
            to="/employee/tasks"
            activeProps={{ className: "bg-accent text-accent-foreground" }}
          >
            <CheckSquare className="h-4 w-4" />
            Assigned Tasks
            {unreadNotifications.length > 0 && (
              <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                {unreadNotifications.length}
              </span>
            )}
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
