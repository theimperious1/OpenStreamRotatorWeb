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
import { useTeam, useMyRole } from "@/lib/team-context";
import { useInstanceWs } from "@/lib/instance-ws-context";
import {
  PlayCircle,
  SkipForward,
  Loader2,
  FileVideo,
  Download,
  RefreshCw,
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

export default function QueuePage() {
  const { activeTeam, activeInstance, loading: teamLoading } = useTeam();
  const { canControl } = useMyRole();
  const instance = activeInstance;
  const { state, sendCommand, connected, lastAck } = useInstanceWs();

  const currentVideo = state?.current_video ?? instance?.current_video;
  const currentPlaylist = state?.current_playlist ?? instance?.current_playlist;
  const currentCategory = (() => {
    const raw = state?.current_category ?? instance?.current_category;
    if (!raw) return null;
    if (typeof raw === "string") return raw;
    return raw.twitch || raw.kick || null;
  })();
  const queue = state?.queue ?? [];
  const downloadActive = state?.download_active ?? false;
  const canSkip = state?.can_skip ?? true;
  const canTriggerRotation = state?.can_trigger_rotation ?? true;

  // Find the index of the currently playing video in the queue
  const currentIndex = currentVideo
    ? queue.findIndex((f) => f === currentVideo || currentVideo.includes(f.replace(/^\d+_/, "")))
    : -1;

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
          <h2 className="text-2xl font-bold tracking-tight">Queue</h2>
          <p className="text-muted-foreground">
            Current rotation playback order
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
          {downloadActive && (
            <Badge
              variant="outline"
              className="text-blue-500 border-blue-500/20"
            >
              <Download className="h-3 w-3 mr-1" />
              Downloading
            </Badge>
          )}
          {lastAck && !lastAck.delivered && (
            <Badge
              variant="outline"
              className="text-red-500 border-red-500/20"
            >
              OSR Unreachable
            </Badge>
          )}
          <CommandButton
            label="Skip Current"
            icon={SkipForward}
            onClick={() => sendCommand("skip_video")}
            disabled={!instance || !connected || !canSkip || !canControl}
          />
          <CommandButton
            label="Trigger Rotation"
            icon={RefreshCw}
            onClick={() => sendCommand("trigger_rotation")}
            disabled={!instance || !connected || !canTriggerRotation || !canControl}
          />
        </div>
      </div>

      {/* Now Playing */}
      {currentVideo ? (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Now Playing</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{currentVideo}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  {currentPlaylist && <span>{currentPlaylist}</span>}
                  {currentCategory && (
                    <Badge variant="secondary" className="text-[10px]">
                      {currentCategory}
                    </Badge>
                  )}
                </div>
              </div>
              <CommandButton
                label="Skip"
                icon={SkipForward}
                onClick={() => sendCommand("skip_video")}
                disabled={!instance || !connected || !canSkip || !canControl}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {instance
              ? "No video currently playing"
              : "No OSR instance connected"}
          </CardContent>
        </Card>
      )}

      {/* Video Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Video Files in Rotation
          </CardTitle>
          <CardDescription>
            {queue.length} video{queue.length !== 1 ? "s" : ""} in the current
            rotation folder
          </CardDescription>
        </CardHeader>
        <CardContent>
          {queue.length > 0 ? (
            <div className="space-y-1">
              {queue.map((file, i) => {
                const isCurrent = i === currentIndex;
                // Strip the prefix number (e.g., "01_") for cleaner display
                const displayName = file.replace(/^\d+_/, "");
                return (
                  <div
                    key={file}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                      isCurrent
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <span className="text-xs text-muted-foreground w-6 text-right flex-shrink-0">
                      {i + 1}
                    </span>
                    {isCurrent ? (
                      <PlayCircle className="h-4 w-4 text-primary flex-shrink-0" />
                    ) : (
                      <FileVideo className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <span
                      className={`truncate ${
                        isCurrent ? "font-medium text-primary" : ""
                      }`}
                    >
                      {displayName}
                    </span>
                    {isCurrent && (
                      <Badge
                        variant="outline"
                        className="ml-auto text-[10px] text-primary border-primary/30 flex-shrink-0"
                      >
                        Playing
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground border border-dashed rounded-md">
              {connected
                ? "No videos in rotation folder"
                : "Waiting for OSR instance connection..."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
