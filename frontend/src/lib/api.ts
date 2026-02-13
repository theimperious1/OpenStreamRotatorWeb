/**
 * API client for the OpenStreamRotator backend.
 *
 * All functions read the JWT from localStorage and include it as a
 * Bearer token. The base URL defaults to http://localhost:8000 but
 * can be overridden via NEXT_PUBLIC_API_URL.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Helpers ──────────────────────────────────

function authHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("osr_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Types ────────────────────────────────────

export interface User {
  id: string;
  discord_id: string;
  discord_username: string;
  discord_avatar: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  user_id: string;
  discord_username: string;
  discord_avatar: string | null;
  role: "owner" | "content_manager" | "moderator" | "viewer";
  joined_at: string;
}

export interface Instance {
  id: string;
  team_id: string;
  name: string;
  api_key: string;
  status: "online" | "offline" | "paused";
  last_seen: string | null;
  created_at: string;
  current_video: string | null;
  current_playlist: string | null;
  current_category: string | null;
  obs_connected: boolean;
  uptime_seconds: number;
}

export interface TeamDetail extends Team {
  members: TeamMember[];
  instances: Instance[];
}

// ── Auth ─────────────────────────────────────

export function getDiscordLoginUrl(): string {
  return `${API_BASE}/auth/discord/login`;
}

export async function getMe(): Promise<User> {
  return apiFetch<User>("/auth/me");
}

// ── Teams ────────────────────────────────────

export async function listTeams(): Promise<Team[]> {
  return apiFetch<Team[]>("/teams");
}

export async function getTeam(teamId: string): Promise<TeamDetail> {
  return apiFetch<TeamDetail>(`/teams/${teamId}`);
}

export async function createTeam(name: string): Promise<Team> {
  return apiFetch<Team>("/teams", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

// ── Members ──────────────────────────────────

export async function inviteMember(
  teamId: string,
  discordId: string,
  role: TeamMember["role"] = "viewer"
): Promise<TeamMember> {
  return apiFetch<TeamMember>(`/teams/${teamId}/members`, {
    method: "POST",
    body: JSON.stringify({ discord_id: discordId, role }),
  });
}

export async function updateMemberRole(
  teamId: string,
  memberId: string,
  role: TeamMember["role"]
): Promise<TeamMember> {
  return apiFetch<TeamMember>(`/teams/${teamId}/members/${memberId}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function removeMember(
  teamId: string,
  memberId: string
): Promise<void> {
  return apiFetch<void>(`/teams/${teamId}/members/${memberId}`, {
    method: "DELETE",
  });
}

// ── Instances ────────────────────────────────

export async function createInstance(
  teamId: string,
  name: string = "Default Instance"
): Promise<Instance> {
  return apiFetch<Instance>(`/teams/${teamId}/instances`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function deleteInstance(
  teamId: string,
  instanceId: string
): Promise<void> {
  return apiFetch<void>(`/teams/${teamId}/instances/${instanceId}`, {
    method: "DELETE",
  });
}

// ── WebSocket ────────────────────────────────

export function connectDashboardWs(instanceId: string): WebSocket | null {
  const token = typeof window !== "undefined" ? localStorage.getItem("osr_token") : null;
  if (!token) return null;

  const wsBase = API_BASE.replace(/^http/, "ws");
  return new WebSocket(`${wsBase}/ws/dashboard/${instanceId}?token=${token}`);
}
