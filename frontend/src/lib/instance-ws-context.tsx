"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { connectDashboardWs } from "@/lib/api";
import { useTeam } from "@/lib/team-context";

import { toast } from "sonner";

// ── Types ────────────────────────────────────

export interface PlaylistConfig {
  name: string;
  url: string;
  twitch_category: string;
  kick_category: string;
  enabled: boolean;
  priority: number;
}

export interface OsrSettings {
  stream_title_template?: string;
  debug_mode?: boolean;
  notify_video_transitions?: boolean;
  min_playlists_per_rotation?: number;
  max_playlists_per_rotation?: number;
  download_retry_attempts?: number;
  yt_dlp_use_cookies?: boolean;
  yt_dlp_browser_for_cookies?: string;
  yt_dlp_verbose?: boolean;
}

export interface Connections {
  obs: boolean;
  twitch: boolean;
  kick: boolean;
  discord_webhook: boolean;
  twitch_enabled: boolean;
  kick_enabled: boolean;
}

export interface PreparedRotation {
  slug: string;
  title: string;
  playlists: string[];
  status: "created" | "downloading" | "ready" | "scheduled" | "executing" | "completed";
  video_count: number;
  created_at: string | null;
  scheduled_at: string | null;
}

export interface EnvConfigEntry {
  value: string | boolean;
  secret: boolean;
}

/** Env var name → { value, secret } mapping from OSR dashboard state. */
export type EnvConfig = Record<string, EnvConfigEntry>;

export interface InstanceState {
  status: "online" | "offline" | "paused";
  manual_pause: boolean;
  current_video: string | null;
  current_playlist: string | null;
  current_category: { twitch: string; kick: string } | null;
  obs_connected: boolean;
  uptime_seconds: number;
  playlists: PlaylistConfig[];
  settings: OsrSettings;
  queue: string[];
  connections: Connections;
  download_active: boolean;
  can_skip: boolean;
  can_trigger_rotation: boolean;
  prepared_rotations: PreparedRotation[];
  any_downloading: boolean;
  executing_slug: string | null;
  env_config?: EnvConfig;
}

export interface LogEntry {
  timestamp: string;
  level: "info" | "warning" | "error" | "debug";
  message: string;
}

interface InstanceWsState {
  state: InstanceState | null;
  logs: LogEntry[];
  connected: boolean;
  lastAck: { delivered: boolean; action: string } | null;
  sendCommand: (action: string, payload?: Record<string, unknown>) => void;
}

// ── Context ──────────────────────────────────

const InstanceWsContext = createContext<InstanceWsState>({
  state: null,
  logs: [],
  connected: false,
  lastAck: null,
  sendCommand: () => {},
});

// ── Reconnect settings ───────────────────────

const RECONNECT_BASE_MS = 2_000;
const RECONNECT_MAX_MS = 30_000;

// ── Provider ─────────────────────────────────

export function InstanceWsProvider({ children }: { children: ReactNode }) {
  const { activeInstance } = useTeam();
  const instanceId = activeInstance?.id ?? null;

  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<InstanceState | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastAck, setLastAck] = useState<{ delivered: boolean; action: string } | null>(null);

  const lastActionRef = useRef<string>("");
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(RECONNECT_BASE_MS);
  const mountedRef = useRef(true);
  const connectRef = useRef<(id: string) => void>(() => {});

  // Stable connect function stored in a ref so onclose can call it
  const connect = useCallback(
    (id: string) => {
      if (!mountedRef.current) return;

      const ws = connectDashboardWs(id);
      if (!ws) {
        console.warn("[OSR-WS] No token — cannot connect");
        return;
      }

      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        console.log("[OSR-WS] Connected to", id);
        setConnected(true);
        reconnectDelay.current = RECONNECT_BASE_MS; // reset backoff
        toast.dismiss("ws-connect");
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "state") {
            setState(msg.data);
          } else if (msg.type === "log") {
            setLogs((prev) => [msg.data, ...prev].slice(0, 1000));
          } else if (msg.type === "log_history") {
            // Batch of historical logs (oldest-first) sent on connect
            const history: LogEntry[] = Array.isArray(msg.data) ? msg.data : [];
            setLogs((prev) => {
              // History is oldest-first, reverse for newest-first display
              const reversed = [...history].reverse();
              // Merge: history at the bottom, any live logs on top
              return [...prev, ...reversed].slice(0, 1000);
            });
          } else if (msg.type === "command_ack") {
            const delivered = msg.data?.delivered ?? false;
            const action = lastActionRef.current.replace(/_/g, " ");
            console.log("[OSR-WS] Command ack:", { delivered, action });
            setLastAck({ delivered, action: lastActionRef.current });
            if (delivered) {
              toast.success(`Command sent: ${action}`);
            } else {
              toast.error(`Command failed: ${action} — instance offline`);
            }
          } else if (msg.type === "error") {
            const message = msg.data?.message ?? "Unknown error";
            console.warn("[OSR-WS] Server error:", message);
            toast.error(message);
          }
        } catch {
          // ignore malformed
        }
      };

      ws.onclose = (e) => {
        if (!mountedRef.current) return;
        console.log("[OSR-WS] Disconnected:", e.code, e.reason);
        setConnected(false);
        wsRef.current = null;

        // Auto-reconnect with exponential backoff (unless auth/permission error)
        if (e.code !== 4001 && e.code !== 4003 && e.code !== 4004) {
          const delay = reconnectDelay.current;
          console.log(`[OSR-WS] Reconnecting in ${delay}ms...`);
          toast.loading("Reconnecting to OSR...", { id: "ws-connect" });
          reconnectTimer.current = setTimeout(() => {
            reconnectDelay.current = Math.min(delay * 2, RECONNECT_MAX_MS);
            connectRef.current(id);
          }, delay);
        }
      };

      ws.onerror = () => {
        if (!mountedRef.current) return;
        // onclose will fire after onerror — reconnect happens there
      };
    },
    []
  );

  // Keep ref in sync
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Connect / disconnect when instanceId changes
  useEffect(() => {
    mountedRef.current = true;

    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }

    // Close any existing connection without triggering reconnect
    if (wsRef.current) {
      const oldWs = wsRef.current;
      wsRef.current = null;
      oldWs.onclose = null;
      oldWs.close();
    }

    // Clear stale state from previous instance
    setState(null);
    setLogs([]);
    setConnected(false);
    setLastAck(null);

    if (instanceId) {
      reconnectDelay.current = RECONNECT_BASE_MS;
      connect(instanceId);
    }

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [instanceId, connect]);

  const sendCommand = useCallback(
    (action: string, payload: Record<string, unknown> = {}) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn("[OSR-WS] Cannot send command — WebSocket not open. readyState:", ws?.readyState);
        return;
      }
      const msg = JSON.stringify({ type: "command", data: { action, payload } });
      console.log("[OSR-WS] Sending command:", action, payload);
      lastActionRef.current = action;
      ws.send(msg);
    },
    []
  );

  return (
    <InstanceWsContext.Provider value={{ state, logs, connected, lastAck, sendCommand }}>
      {children}
    </InstanceWsContext.Provider>
  );
}

/** Use the shared instance WebSocket connection. */
export function useInstanceWs() {
  return useContext(InstanceWsContext);
}
