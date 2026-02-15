/**
 * API client for the OpenStreamRotator backend.
 *
 * All functions read the JWT from localStorage and include it as a
 * Bearer token. The base URL is determined dynamically:
 *   1. NEXT_PUBLIC_API_URL env var (if set)
 *   2. Same hostname as the current page, port 8000
 *   3. Fallback to http://localhost:8000 (SSR / tests)
 */

function resolveApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return "http://localhost:8000";
}

/** Returns the API base URL, derived from the current page's hostname. */
export function getApiBase(): string {
  return resolveApiBase();
}

// ── Helpers ──────────────────────────────────

function authHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("osr_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
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
  hls_url: string | null;
}

export interface TeamDetail extends Team {
  members: TeamMember[];
  instances: Instance[];
}

// ── Auth ─────────────────────────────────────

export function getDiscordLoginUrl(): string {
  return `${getApiBase()}/auth/discord/login`;
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

export async function renameInstance(
  teamId: string,
  instanceId: string,
  name: string
): Promise<Instance> {
  return apiFetch<Instance>(`/teams/${teamId}/instances/${instanceId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export async function updateInstanceHls(
  teamId: string,
  instanceId: string,
  hlsUrl: string | null
): Promise<Instance> {
  return apiFetch<Instance>(
    `/teams/${teamId}/instances/${instanceId}/hls`,
    {
      method: "PUT",
      body: JSON.stringify({ hls_url: hlsUrl }),
    }
  );
}

export async function getInstanceViewers(
  teamId: string,
  instanceId: string
): Promise<{ viewers: number | null }> {
  return apiFetch<{ viewers: number | null }>(
    `/teams/${teamId}/instances/${instanceId}/viewers`
  );
}

export async function sendPreviewHeartbeat(
  teamId: string,
  instanceId: string
): Promise<void> {
  return apiFetch<void>(
    `/teams/${teamId}/instances/${instanceId}/viewers/heartbeat`,
    { method: "POST" }
  );
}

// ── Invite Links ─────────────────────────────

export interface InviteLink {
  id: string;
  team_id: string;
  team_name: string;
  code: string;
  role: TeamMember["role"];
  status: "pending" | "accepted" | "revoked";
  max_uses: number;
  use_count: number;
  created_at: string;
  expires_at: string | null;
  created_by: string;
}

export interface InviteInfo {
  code: string;
  team_name: string;
  role: TeamMember["role"];
  created_by: string;
  expires_at: string | null;
  is_valid: boolean;
}

export async function createInviteLink(
  teamId: string,
  role: TeamMember["role"] = "viewer",
  maxUses: number = 0,
  expiresInHours: number | null = null
): Promise<InviteLink> {
  return apiFetch<InviteLink>(`/teams/${teamId}/invites`, {
    method: "POST",
    body: JSON.stringify({
      role,
      max_uses: maxUses,
      expires_in_hours: expiresInHours,
    }),
  });
}

export async function listInviteLinks(teamId: string): Promise<InviteLink[]> {
  return apiFetch<InviteLink[]>(`/teams/${teamId}/invites`);
}

export async function revokeInviteLink(
  teamId: string,
  inviteId: string
): Promise<void> {
  return apiFetch<void>(`/teams/${teamId}/invites/${inviteId}`, {
    method: "DELETE",
  });
}

export async function getInviteInfo(code: string): Promise<InviteInfo> {
  return apiFetch<InviteInfo>(`/invites/${code}`);
}

export async function acceptInvite(code: string): Promise<TeamMember> {
  return apiFetch<TeamMember>(`/invites/${code}/accept`, {
    method: "POST",
  });
}

// ── WebSocket ────────────────────────────────

export function connectDashboardWs(instanceId: string): WebSocket | null {
  const token = typeof window !== "undefined" ? localStorage.getItem("osr_token") : null;
  if (!token) return null;

  const wsBase = getApiBase().replace(/^http/, "ws");
  return new WebSocket(`${wsBase}/ws/dashboard/${instanceId}?token=${token}`);
}
