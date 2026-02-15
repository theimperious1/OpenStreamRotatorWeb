"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListMusic,
  PlayCircle,
  ScrollText,
  Users,
  Settings,
  Radio,
  LogOut,
  FolderClock,
  Server,
  ChevronDown,
  Tv,
} from "lucide-react";
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
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useTeam } from "@/lib/team-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Playlists", href: "/dashboard/playlists", icon: ListMusic },
  { title: "Queue", href: "/dashboard/queue", icon: PlayCircle },
  { title: "Prepared", href: "/dashboard/prepared", icon: FolderClock },
  { title: "Logs", href: "/dashboard/logs", icon: ScrollText },
  { title: "Preview", href: "/dashboard/preview", icon: Tv },
  { title: "Team", href: "/dashboard/team", icon: Users },
  { title: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { activeTeam, activeInstance, selectInstance } = useTeam();

  const instances = activeTeam?.instances ?? [];
  const instance = activeInstance;
  const isOnline = instance?.status === "online";
  const isPaused = instance?.status === "paused";
  const multipleInstances = instances.length > 1;

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Radio className="h-6 w-6 text-red-500" />
          <div>
            <h1 className="text-sm font-bold leading-none">
              OpenStreamRotator
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeTeam ? activeTeam.name : "Stream Dashboard"}
            </p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      pathname === item.href ||
                      (item.href !== "/dashboard" &&
                        pathname.startsWith(item.href))
                    }
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Stream Status</SidebarGroupLabel>
          <SidebarGroupContent className="px-2">
            {instance ? (
              <>
                <div className="flex items-center gap-2 text-xs">
                  <span className="relative flex h-2 w-2">
                    {isOnline && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${
                        isPaused
                          ? "bg-yellow-500"
                          : isOnline
                          ? "bg-green-500"
                          : "bg-red-500"
                      }`}
                    ></span>
                  </span>
                  <span className="text-muted-foreground">
                    {isPaused
                      ? "Paused"
                      : isOnline
                      ? "Stream Online"
                      : "Stream Offline"}
                  </span>
                </div>
                {instance.obs_connected && (
                  <div className="flex items-center gap-2 text-xs mt-2">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      OBS
                    </Badge>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                No instance connected
              </p>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

        {instances.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Instance</SidebarGroupLabel>
            <SidebarGroupContent className="px-2">
              <Select
                value={instance?.id ?? ""}
                onValueChange={selectInstance}
              >
                <SelectTrigger className="h-8 text-xs w-full">
                  <Server className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                  <SelectValue placeholder="Select instance" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex rounded-full h-1.5 w-1.5 ${
                            inst.status === "online"
                              ? "bg-green-500"
                              : inst.status === "paused"
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                        />
                        {inst.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            {user?.discord_avatar && (
              <AvatarImage src={user.discord_avatar} alt={user.discord_username} />
            )}
            <AvatarFallback className="text-xs">
              {user?.discord_username?.slice(0, 2).toUpperCase() ?? "??"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">
              {user?.discord_username ?? "Unknown"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {activeTeam?.members?.find((m) => m.user_id === user?.id)?.role?.replace("_", " ") ?? "—"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={logout}
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
