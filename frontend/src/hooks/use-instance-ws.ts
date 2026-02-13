"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { connectDashboardWs } from "@/lib/api";

export interface PlaylistConfig {
  name: string;
  url: string;
  category: string;
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

export interface InstanceState {
  status: "online" | "offline" | "paused";
  current_video: string | null;
  current_playlist: string | null;
  current_category: string | null;
  obs_connected: boolean;
  uptime_seconds: number;
  playlists: PlaylistConfig[];
  settings: OsrSettings;
  queue: string[];
  connections: Connections;
  download_active: boolean;
}

export interface LogEntry {
  timestamp: string;
  level: "info" | "warning" | "error" | "debug";
  message: string;
}

interface UseInstanceWsReturn {
  state: InstanceState | null;
  logs: LogEntry[];
  connected: boolean;
  /** Last command acknowledgement from the server */
  lastAck: { delivered: boolean; action: string } | null;
  sendCommand: (action: string, payload?: Record<string, unknown>) => void;
}

/**
 * Hook that connects to an OSR instance's WebSocket and provides
 * live state updates and log entries.
 */
export function useInstanceWs(instanceId: string | null): UseInstanceWsReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<InstanceState | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastAck, setLastAck] = useState<{ delivered: boolean; action: string } | null>(null);
  const lastActionRef = useRef<string>("");

  useEffect(() => {
    if (!instanceId) return;

    // Guard against React StrictMode double-mount race conditions.
    // When StrictMode unmounts and re-mounts, the OLD WebSocket's
    // onclose handler could fire AFTER the NEW one is created,
    // clobbering wsRef.current.  The `cancelled` flag ensures that
    // only the most-recent WebSocket's callbacks touch state/refs.
    let cancelled = false;

    const ws = connectDashboardWs(instanceId);
    if (!ws) {
      console.warn("[OSR-WS] No token — cannot connect");
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      if (cancelled) return;
      console.log("[OSR-WS] Connected to", instanceId);
      setConnected(true);
    };

    ws.onmessage = (event) => {
      if (cancelled) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "state") {
          setState(msg.data);
        } else if (msg.type === "log") {
          setLogs((prev) => [msg.data, ...prev].slice(0, 500));
        } else if (msg.type === "command_ack") {
          const delivered = msg.data?.delivered ?? false;
          console.log("[OSR-WS] Command ack:", { delivered, action: lastActionRef.current });
          setLastAck({ delivered, action: lastActionRef.current });
        } else if (msg.type === "error") {
          console.warn("[OSR-WS] Server error:", msg.data?.message);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = (e) => {
      if (cancelled) return;               // ← stale WS, ignore
      console.log("[OSR-WS] Disconnected:", e.code, e.reason);
      setConnected(false);
      wsRef.current = null;
    };

    ws.onerror = () => {
      if (cancelled) return;
      setConnected(false);
    };

    return () => {
      cancelled = true;                    // prevent stale callbacks
      ws.close();
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
    };
  }, [instanceId]);

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

  return { state, logs, connected, lastAck, sendCommand };
}
