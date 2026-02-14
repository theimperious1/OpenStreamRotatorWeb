"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTeam, useMyRole } from "@/lib/team-context";
import { useInstanceWs, type LogEntry } from "@/lib/instance-ws-context";
import {
  Monitor,
  Clock,
  PlayCircle,
  AlertCircle,
  Wifi,
  WifiOff,
  Loader2,
  Play,
  Pause,
} from "lucide-react";

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

function ConnectionBadge({
  label,
  connected,
}: {
  label: string;
  connected: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {connected ? (
        <Wifi className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <WifiOff className="h-3.5 w-3.5 text-red-500" />
      )}
      <span className="text-sm">{label}</span>
    </div>
  );
}

function LogLevelBadge({ level }: { level: LogEntry["level"] }) {
  const variant =
    level === "error"
      ? "destructive"
      : level === "warning"
      ? "secondary"
      : "outline";
  return (
    <Badge variant={variant} className="text-[10px] px-1.5 py-0 shrink-0 mt-0.5">
      {level}
    </Badge>
  );
}

export default function DashboardPage() {
  const { activeTeam, loading: teamLoading } = useTeam();
  const { canControl } = useMyRole();
  const instance = activeTeam?.instances?.[0] ?? null;
  const { state, logs, connected, sendCommand } = useInstanceWs();

  // Merge WebSocket live state with the DB snapshot from the team detail
  const isOnline = state?.status === "online" || instance?.status === "online";
  const isPaused = state?.status === "paused" || instance?.status === "paused";
  const isManualPause = state?.manual_pause ?? false;
  const currentVideo = state?.current_video ?? instance?.current_video ?? "—";
  const currentPlaylist = state?.current_playlist ?? instance?.current_playlist ?? "—";
  const currentCategory = (() => {
    const raw = state?.current_category ?? instance?.current_category;
    if (!raw) return "—";
    if (typeof raw === "string") return raw;
    return raw.twitch || raw.kick || "—";
  })();
  const obsConnected = state?.obs_connected ?? instance?.obs_connected ?? false;
  const uptimeSeconds = state?.uptime_seconds ?? instance?.uptime_seconds ?? 0;

  if (teamLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activeTeam) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            No team found. Create a team in the Team page to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Stream overview and real-time status
        </p>
      </div>

      {/* Status Banner */}
      <Card
        className={
          isPaused
            ? "border-yellow-500/50 bg-yellow-500/5"
            : isOnline
            ? "border-green-500/50 bg-green-500/5"
            : "border-red-500/50 bg-red-500/5"
        }
      >
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              {isOnline && !isPaused && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-3 w-3 ${
                  isPaused
                    ? "bg-yellow-500"
                    : isOnline
                    ? "bg-green-500"
                    : "bg-red-500"
                }`}
              ></span>
            </span>
            <div>
              <p className="font-semibold">
                {isPaused
                  ? isManualPause
                    ? "Stream Paused — Manual"
                    : "Stream Paused — Streamer is Live"
                  : isOnline
                  ? "Stream Online"
                  : "Stream Offline"}
              </p>
              {(isOnline || isPaused) && uptimeSeconds > 0 && (
                <p className="text-sm text-muted-foreground">
                  Uptime: {formatUptime(uptimeSeconds)}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {connected && (isOnline || isPaused) && (
              <Button
                variant={isPaused && isManualPause ? "default" : "outline"}
                size="sm"
                className="gap-1.5"
                disabled={!canControl}
                onClick={() =>
                  sendCommand(
                    isPaused && isManualPause ? "resume_stream" : "pause_stream"
                  )
                }
              >
                {isPaused && isManualPause ? (
                  <>
                    <Play className="h-4 w-4" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4" />
                    Pause
                  </>
                )}
              </Button>
            )}
            {connected && (
              <Badge variant="outline" className="text-green-500 border-green-500/30 text-[10px]">
                Live
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Now Playing</CardTitle>
            <PlayCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold truncate">{currentVideo}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {currentPlaylist}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Category</CardTitle>
            <Monitor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold">{currentCategory}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Auto-updated per video
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold">
              {uptimeSeconds > 0 ? formatUptime(uptimeSeconds) : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Since last restart
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Connections */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connections</CardTitle>
            <CardDescription>Service connectivity status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ConnectionBadge label="OBS WebSocket" connected={obsConnected} />
            <ConnectionBadge label="Web Dashboard" connected={connected} />
            {!instance && (
              <div className="flex items-center gap-1.5 pt-2 border-t">
                <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
                <span className="text-sm text-yellow-500">
                  No OSR instance registered
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <CardDescription>
              {logs.length > 0
                ? "Latest log entries via WebSocket"
                : "Logs will appear when an OSR instance connects"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {logs.slice(0, 8).map((log, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <LogLevelBadge level={log.level} />
                  <span className="text-muted-foreground truncate">
                    {log.message}
                  </span>
                </div>
              ))}
              {logs.length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No activity yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
