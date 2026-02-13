"use client";

import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/lib/auth-context";
import { TeamProvider } from "@/lib/team-context";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    router.replace("/");
    return null;
  }

  return (
    <TeamProvider>
      <SidebarProvider>
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="flex items-center gap-2 border-b px-4 py-2">
            <SidebarTrigger />
          </div>
          <div className="p-6">{children}</div>
        </main>
      </SidebarProvider>
    </TeamProvider>
  );
}
