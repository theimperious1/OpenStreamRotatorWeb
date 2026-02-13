"use client";

import { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTeam } from "@/lib/team-context";
import { useInstanceWs } from "@/hooks/use-instance-ws";
import {
  Music,
  ExternalLink,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowUpDown,
  Check,
} from "lucide-react";

/** Button that shows brief "Sent!" feedback after click. */
function CommandButton({
  label,
  icon: Icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled: boolean;
}) {
  const [sent, setSent] = useState(false);
  const handleClick = useCallback(() => {
    onClick();
    setSent(true);
    setTimeout(() => setSent(false), 1500);
  }, [onClick]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={disabled || sent}
    >
      {sent ? (
        <>
          <Check className="h-4 w-4 mr-2 text-green-500" />
          Sent!
        </>
      ) : (
        <>
          <Icon className="h-4 w-4 mr-2" />
          {label}
        </>
      )}
    </Button>
  );
}

export default function PlaylistsPage() {
  const { activeTeam, loading: teamLoading } = useTeam();
  const instance = activeTeam?.instances?.[0] ?? null;
  const { state, sendCommand, connected, lastAck } = useInstanceWs(instance?.id ?? null);

  const playlists = state?.playlists ?? [];
  const settings = state?.settings;
  const currentPlaylist = state?.current_playlist ?? instance?.current_playlist;

  if (teamLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Playlists</h2>
          <p className="text-muted-foreground">
            Content playlists configured on the OSR instance
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connected && (
            <Badge
              variant="outline"
              className="text-green-500 border-green-500/20"
            >
              Live
            </Badge>
          )}
          <CommandButton
            label="Trigger Rotation"
            icon={RefreshCw}
            onClick={() => sendCommand("trigger_rotation")}
            disabled={!instance || !connected}
          />
        </div>
      </div>

      {/* Current Rotation */}
      {currentPlaylist && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Currently rotating:</span>
              <span className="text-sm">{currentPlaylist}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Playlist Grid */}
      {playlists.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {playlists.map((playlist) => {
            const isActive = currentPlaylist
              ?.split(", ")
              .includes(playlist.name);
            return (
              <Card
                key={playlist.name}
                className={
                  isActive ? "border-primary/50 bg-primary/5" : undefined
                }
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">
                      {playlist.name}
                    </CardTitle>
                    <div className="flex items-center gap-1.5">
                      {isActive && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 text-primary border-primary/30"
                        >
                          Playing
                        </Badge>
                      )}
                      {playlist.enabled ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px]">
                      {playlist.category}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <ArrowUpDown className="h-3 w-3" />
                      <span>Priority {playlist.priority}</span>
                    </div>
                  </div>
                  <a
                    href={playlist.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors truncate"
                  >
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{playlist.url}</span>
                  </a>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {connected
              ? "No playlists configured on the OSR instance"
              : instance
              ? "Waiting for OSR instance connection..."
              : "No OSR instance registered"}
          </CardContent>
        </Card>
      )}

      {/* Rotation Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rotation Settings</CardTitle>
          <CardDescription>
            How many playlists are selected per rotation cycle
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Min per rotation:</span>{" "}
              <span className="font-medium">
                {settings?.min_playlists_per_rotation ?? "—"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Max per rotation:</span>{" "}
              <span className="font-medium">
                {settings?.max_playlists_per_rotation ?? "—"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Selection method:</span>{" "}
              <span className="font-medium">Least recently played</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
