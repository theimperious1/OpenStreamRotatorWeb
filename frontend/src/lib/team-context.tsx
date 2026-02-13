"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { listTeams, getTeam, type Team, type TeamDetail } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

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
