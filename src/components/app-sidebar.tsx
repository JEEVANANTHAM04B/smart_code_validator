import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Code2, History, ShieldCheck, Users, FileText, Activity } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar({ session }: { session?: any }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (router) => router.location.pathname });

  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname.startsWith(url));

  const workspaceItems = session?.isAdmin
    ? [
        { title: "Admin Dashboard", url: "/admin", icon: LayoutDashboard },
        { title: "Code Validator", url: "/validator", icon: Code2 },
        { title: "Task Management", url: "/admin/tasks", icon: FileText },
        { title: "Employees", url: "/admin/employees", icon: Users },
        { title: "Submissions", url: "/admin/submissions", icon: Activity },
        { title: "History", url: "/history", icon: History },
      ]
    : [
        { title: "Employee Dashboard", url: "/employee", icon: LayoutDashboard },
        { title: "Assigned Tasks", url: "/employee/tasks", icon: FileText },
        { title: "Code Validator", url: "/validator", icon: Code2 },
        { title: "My History", url: "/employee/history", icon: History },
      ];

  const portalItems = session?.isAdmin
    ? [{ title: "Admin Portal", url: "/admin", icon: ShieldCheck }]
    : [{ title: "Employee Portal", url: "/employee", icon: ShieldCheck }];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 p-1">
            <BrandLogo className="size-full" />
          </span>
          {!collapsed && (
            <span className="flex flex-col leading-tight">
              <span className="text-base font-bold tracking-wide text-sidebar-foreground drop-shadow-sm">Code Pilot</span>
              <span className="text-[11px] font-semibold text-primary">AI Validation Platform</span>
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspaceItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="size-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
          <SidebarGroupLabel>Portals</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {portalItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="size-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
