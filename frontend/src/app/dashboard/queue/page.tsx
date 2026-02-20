"use client";

import { useState, useCallback, useRef } from "react";
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
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

/** Button that shows brief "Sent!" feedback after click. */
function CommandButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  loading,
  disabledReason,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled: boolean;
  loading?: boolean;
  disabledReason?: string;
}) {
  const [sent, setSent] = useState(false);
  const handleClick = useCallback(() => {
    onClick();
    setSent(true);
    setTimeout(() => setSent(false), 1500);
  }, [onClick]);

  const showLoading = loading && !sent;
  const isDisabled = disabled || sent || loading;

  const button = (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isDisabled}
    >
      {sent ? (
        <>
          <Check className="h-4 w-4 mr-2 text-green-500" />
          Sent!
        </>
      ) : showLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          {label}
        </>
      ) : (
        <>
          <Icon className="h-4 w-4 mr-2" />
          {label}
        </>
      )}
    </Button>
  );

  if (isDisabled && disabledReason) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-not-allowed">{button}</span>
        </TooltipTrigger>
        <TooltipContent>{disabledReason}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

export default function QueuePage() {
  const { activeInstance: instance, loading: teamLoading } = useTeam();
  const { canControl } = useMyRole();
  const { state, sendCommand, connected, lastAck } = useInstanceWs();

  const currentVideo = state?.current_video ?? null;
  const currentPlaylist = state?.current_playlist ?? null;
  const currentCategory = (() => {
    const raw = state?.current_category ?? null;
    if (!raw) return null;
    if (typeof raw === "string") return raw;
    return raw.twitch || raw.kick || null;
  })();
  const queue = state?.queue ?? [];
  const downloadActive = state?.download_active ?? false;
  const canSkip = state?.can_skip ?? true;
  const canTriggerRotation = state?.can_trigger_rotation ?? true;

  // ── Command cooldown: disable skip/rotate buttons until state reflects the change ──
  const [cooldownState, setCooldownState] = useState<{
    active: boolean;
    video: string | null;
  }>({ active: false, video: null });
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Render-time adjustment: clear cooldown when current_video changes (command took effect)
  if (
    cooldownState.active &&
    cooldownState.video !== null &&
    currentVideo !== cooldownState.video
  ) {
    setCooldownState({ active: false, video: null });
  }

  const commandCooldown = cooldownState.active;

  // Compute disabled reasons for command buttons
  const skipDisabledReason = !instance
    ? "No instance selected"
    : !connected
      ? "Not connected"
      : !canControl
        ? "Insufficient permissions"
        : !canSkip
          ? downloadActive
            ? "Next rotation is downloading"
            : "No videos to skip"
          : commandCooldown
            ? "Processing..."
            : undefined;

  const rotationDisabledReason = !instance
    ? "No instance selected"
    : !connected
      ? "Not connected"
      : !canControl
        ? "Insufficient permissions"
        : !canTriggerRotation
          ? downloadActive
            ? "Next rotation is downloading"
            : "A rotation is already in progress"
          : commandCooldown
            ? "Processing..."
            : undefined;

  const startCooldown = useCallback(() => {
    setCooldownState({ active: true, video: currentVideo });
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = setTimeout(() => {
      setCooldownState({ active: false, video: null });
    }, 4000);
  }, [currentVideo]);

  const handleSkip = useCallback(() => {
    sendCommand("skip_video");
    startCooldown();
  }, [sendCommand, startCooldown]);

  const handleTriggerRotation = useCallback(() => {
    sendCommand("trigger_rotation");
    startCooldown();
  }, [sendCommand, startCooldown]);

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
          {state && state.status !== "offline" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="text-green-500 border-green-500/20 cursor-help"
                >
                  Live
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Connected to OSR instance in real-time</TooltipContent>
            </Tooltip>
          )}
          {downloadActive && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="text-blue-500 border-blue-500/20 cursor-help"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Downloading
                </Badge>
              </TooltipTrigger>
              <TooltipContent>A video is currently being downloaded</TooltipContent>
            </Tooltip>
          )}
          {lastAck && !lastAck.delivered && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="text-red-500 border-red-500/20 cursor-help"
                >
                  OSR Unreachable
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Last command could not be delivered to the OSR instance</TooltipContent>
            </Tooltip>
          )}
          <CommandButton
            label="Skip Current"
            icon={SkipForward}
            onClick={handleSkip}
            disabled={!instance || !connected || !canSkip || !canControl}
            loading={commandCooldown}
            disabledReason={skipDisabledReason}
          />
          <CommandButton
            label="Trigger Rotation"
            icon={RefreshCw}
            onClick={handleTriggerRotation}
            disabled={!instance || !connected || !canTriggerRotation || !canControl}
            loading={commandCooldown}
            disabledReason={rotationDisabledReason}
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
                onClick={handleSkip}
                disabled={!instance || !connected || !canSkip || !canControl}
                loading={commandCooldown}
                disabledReason={skipDisabledReason}
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <PlayCircle className="h-4 w-4 text-primary flex-shrink-0 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>Currently playing</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <FileVideo className="h-4 w-4 text-muted-foreground flex-shrink-0 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>Queued for playback</TooltipContent>
                      </Tooltip>
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
