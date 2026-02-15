"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { listTeams, getTeam, type Team, type TeamDetail, type Instance } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export type TeamRole = "owner" | "content_manager" | "moderator" | "viewer";

interface TeamState {
  teams: Team[];
  activeTeam: TeamDetail | null;
  activeInstance: Instance | null;
  loading: boolean;
  /** Re-fetch everything */
  refresh: () => Promise<void>;
  /** Switch to a different team */
  selectTeam: (teamId: string) => Promise<void>;
  /** Switch to a different instance within the active team */
  selectInstance: (instanceId: string) => void;
}

const TeamContext = createContext<TeamState>({
  teams: [],
  activeTeam: null,
  activeInstance: null,
  loading: true,
  refresh: async () => {},
  selectTeam: async () => {},
  selectInstance: () => {},
});

export function TeamProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeam, setActiveTeam] = useState<TeamDetail | null>(null);
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(() => {
    if (typeof window !== "undefined") return localStorage.getItem("osr_active_instance");
    return null;
  });
  const [loading, setLoading] = useState(true);

  // Derive active instance from activeTeam + selected id (fallback to first)
  const activeInstance = useMemo(() => {
    const instances = activeTeam?.instances ?? [];
    if (instances.length === 0) return null;
    return instances.find((i) => i.id === activeInstanceId) ?? instances[0];
  }, [activeTeam?.instances, activeInstanceId]);

  const selectInstance = useCallback((instanceId: string) => {
    setActiveInstanceId(instanceId);
    if (typeof window !== "undefined") localStorage.setItem("osr_active_instance", instanceId);
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const all = await listTeams();
      setTeams(all);

      // Auto-select first team if we don't have one yet
      const targetId = activeTeam?.id ?? all[0]?.id;
      if (targetId) {
        const detail = await getTeam(targetId);
        setActiveTeam(detail);
      }
    } catch {
      // API might be down — gracefully degrade
    } finally {
      setLoading(false);
    }
  }, [user, activeTeam?.id]);

  const selectTeam = useCallback(async (teamId: string) => {
    setLoading(true);
    try {
      const detail = await getTeam(teamId);
      setActiveTeam(detail);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <TeamContext.Provider value={{ teams, activeTeam, activeInstance, loading, refresh, selectTeam, selectInstance }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  return useContext(TeamContext);
}

/**
 * Convenience hook — returns the current user's role in the active team.
 *
 * Role hierarchy (most → least privileged):
 *   owner > content_manager > moderator > viewer
 *
 * Also exposes boolean helpers so pages don't have to repeat
 * role comparison logic everywhere.
 */
export function useMyRole() {
  const { user } = useAuth();
  const { activeTeam } = useTeam();

  return useMemo(() => {
    const role: TeamRole =
      activeTeam?.members?.find((m) => m.user_id === user?.id)?.role as TeamRole ?? "viewer";

    const ROLE_RANK: Record<TeamRole, number> = {
      owner: 4,
      content_manager: 3,
      moderator: 2,
      viewer: 1,
    };

    const atLeast = (min: TeamRole) => ROLE_RANK[role] >= ROLE_RANK[min];

    return {
      role,
      isOwner: role === "owner",
      /** Can pause/resume, skip, trigger rotation, toggle playlists */
      canControl: atLeast("moderator"),
      /** Can CRUD playlists, prepared rotations, change settings */
      canManageContent: atLeast("content_manager"),
      /** True for viewer — read-only access */
      isViewOnly: role === "viewer",
    };
  }, [user?.id, activeTeam?.members]);
}
