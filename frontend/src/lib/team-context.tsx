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
import { listTeams, getTeam, type Team, type TeamDetail } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export type TeamRole = "owner" | "content_manager" | "moderator" | "viewer";

interface TeamState {
  teams: Team[];
  activeTeam: TeamDetail | null;
  loading: boolean;
  /** Re-fetch everything */
  refresh: () => Promise<void>;
  /** Switch to a different team */
  selectTeam: (teamId: string) => Promise<void>;
}

const TeamContext = createContext<TeamState>({
  teams: [],
  activeTeam: null,
  loading: true,
  refresh: async () => {},
  selectTeam: async () => {},
});

export function TeamProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeam, setActiveTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);

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
    <TeamContext.Provider value={{ teams, activeTeam, loading, refresh, selectTeam }}>
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
