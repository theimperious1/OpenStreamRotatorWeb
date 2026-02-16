"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useTeam } from "@/lib/team-context";
import { useMyRole } from "@/lib/team-context";
import { useInstanceWs, type LogEntry } from "@/lib/instance-ws-context";
import { Search, Filter, Loader2, ShieldAlert } from "lucide-react";

const levelColors: Record<LogEntry["level"], string> = {
  info: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  warning: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  error: "bg-red-500/10 text-red-500 border-red-500/20",
  debug: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

export default function LogsPage() {
  const { loading: teamLoading } = useTeam();
  const { isViewOnly } = useMyRole();
  const { logs: wsLogs, connected, state } = useInstanceWs();
  const [filter, setFilter] = useState<LogEntry["level"] | "all">("all");
  const [search, setSearch] = useState("");

  const logs = wsLogs.filter((log) => {
    if (filter !== "all" && log.level !== filter) return false;
    if (search && !log.message.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  if (teamLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isViewOnly) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
        <ShieldAlert className="h-10 w-10" />
        <p className="text-sm">Logs are not available for the Viewer role.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Logs</h2>
          <p className="text-muted-foreground">
            {connected && state?.status !== "offline"
              ? "Live log stream from your OSR instance"
              : "Logs will stream when an OSR instance connects"}{" "}
            <span className="text-xs">— logs are live only and do not persist across restarts</span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {connected && state?.status !== "offline" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-green-500 border-green-500/30 cursor-help">
                  Live
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Real-time connection to OSR instance is active</TooltipContent>
            </Tooltip>
          )}
          {logs.length} entries
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex items-center gap-3 py-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {(["all", "info", "warning", "error", "debug"] as const).map(
              (level) => (
                <Button
                  key={level}
                  variant={filter === level ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(level)}
                  className="text-xs capitalize"
                >
                  {level}
                </Button>
              )
            )}
          </div>
        </CardContent>
      </Card>

      {/* Log Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Log Stream
            <Badge variant="outline" className="ml-2 text-xs">
              {logs.length} entries
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="font-mono text-xs space-y-1">
            {logs.map((log, i) => (
              <div
                key={i}
                className="flex items-start gap-3 py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
              >
                <span className="text-muted-foreground shrink-0 w-[140px]">
                  {log.timestamp ? new Date(log.timestamp).toLocaleString() : "—"}
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 shrink-0 w-[60px] text-center justify-center ${
                    levelColors[log.level]
                  }`}
                >
                  {log.level.toUpperCase()}
                </Badge>
                <span className="text-foreground">{log.message}</span>
              </div>
            ))}
          </div>

          {logs.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              No logs matching your filters.
            </div>
          )}

          {wsLogs.length >= 2000 && (
            <p className="text-center text-xs text-muted-foreground pt-4 border-t mt-4">
              Showing the most recent 2,000 log entries. Older entries are not retained in the live view.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
