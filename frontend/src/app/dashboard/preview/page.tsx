"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useTeam, useMyRole } from "@/lib/team-context";
import { updateInstanceHls, getInstanceViewers, sendPreviewHeartbeat } from "@/lib/api";
import { toast } from "sonner";
import {
  Tv,
  Copy,
  Check,
  ChevronDown,
  Settings2,
  Radio,
  AlertCircle,
  Loader2,
  Save,
  XCircle,
  Users,
} from "lucide-react";

// ── Stream status type ───────────────────────
type StreamStatus = "loading" | "live" | "offline" | "no-url";

// ── Hook: heartbeat + poll backend for viewer count ──────
function useViewerCount(
  teamId: string | undefined,
  instanceId: string | undefined,
  isLive: boolean
) {
  const [viewers, setViewers] = useState<number | null>(null);

  // Send heartbeats while on the preview page and stream is live
  useEffect(() => {
    if (!teamId || !instanceId || !isLive) return;

    // Send immediately on mount / when going live
    sendPreviewHeartbeat(teamId, instanceId).catch(() => {});

    const id = setInterval(() => {
      sendPreviewHeartbeat(teamId!, instanceId!).catch(() => {});
    }, 10_000);

    return () => clearInterval(id);
  }, [teamId, instanceId, isLive]);

  // Poll viewer count
  useEffect(() => {
    if (!teamId || !instanceId || !isLive) {
      queueMicrotask(() => setViewers(null));
      return;
    }

    let cancelled = false;

    async function poll() {
      try {
        const data = await getInstanceViewers(teamId!, instanceId!);
        if (!cancelled) setViewers(data.viewers);
      } catch {
        if (!cancelled) setViewers(null);
      }
    }

    // Small delay so our own heartbeat registers first
    const initialTimer = setTimeout(poll, 1000);
    const id = setInterval(poll, 10_000);
    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      clearInterval(id);
    };
  }, [teamId, instanceId, isLive]);

  return viewers;
}

// ── HLS Player component ─────────────────────
function HlsPlayer({
  url,
  onStatusChange,
}: {
  url: string;
  onStatusChange: (status: StreamStatus) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    onStatusChange("loading");

    function cleanup() {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    }

    function attach() {
      cleanup();

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          // Retry fetching quickly — stream may start any moment
          manifestLoadingMaxRetry: 6,
          manifestLoadingRetryDelay: 3000,
          levelLoadingMaxRetry: 6,
          levelLoadingRetryDelay: 3000,
          fragLoadingMaxRetry: 6,
          fragLoadingRetryDelay: 3000,
        });
        hlsRef.current = hls;

        hls.loadSource(url);
        hls.attachMedia(video!);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          onStatusChange("live");
          video?.play().catch(() => {});
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            onStatusChange("offline");
            // Retry after 10s
            retryTimerRef.current = setTimeout(() => attach(), 10_000);
          }
        });
      } else if (video && video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari native HLS
        video.src = url;
        video.addEventListener("loadedmetadata", () => {
          onStatusChange("live");
          video.play().catch(() => {});
        });
        video.addEventListener("error", () => {
          onStatusChange("offline");
          retryTimerRef.current = setTimeout(() => attach(), 10_000);
        });
      } else {
        onStatusChange("offline");
      }
    }

    attach();
    return cleanup;
  }, [url, onStatusChange]);

  return (
    <video
      ref={videoRef}
      className="w-full h-full object-contain bg-black rounded-lg"
      muted
      playsInline
      controls
    />
  );
}

// ── Main page ────────────────────────────────
export default function StreamPreviewPage() {
  const { activeTeam, activeInstance, refresh } = useTeam();
  const { canManageContent } = useMyRole();

  const [streamStatus, setStreamStatus] = useState<StreamStatus>("no-url");

  // HLS URL editing state
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const hlsUrl = activeInstance?.hls_url ?? null;

  // Poll backend proxy for viewer count when live
  const viewers = useViewerCount(activeTeam?.id, activeInstance?.id, streamStatus === "live");

  // Start editing
  const startEditing = useCallback(() => {
    setUrlDraft(hlsUrl ?? "");
    setEditingUrl(true);
  }, [hlsUrl]);

  // Save the URL
  const saveUrl = useCallback(async () => {
    if (!activeTeam || !activeInstance) return;
    setSaving(true);
    try {
      await updateInstanceHls(
        activeTeam.id,
        activeInstance.id,
        urlDraft.trim() || null
      );
      toast.success("HLS URL updated");
      setEditingUrl(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save HLS URL");
    } finally {
      setSaving(false);
    }
  }, [activeTeam, activeInstance, urlDraft, refresh]);

  // Clear the URL
  const clearUrl = useCallback(async () => {
    if (!activeTeam || !activeInstance) return;
    setSaving(true);
    try {
      await updateInstanceHls(activeTeam.id, activeInstance.id, null);
      toast.success("HLS URL cleared");
      setEditingUrl(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clear URL");
    } finally {
      setSaving(false);
    }
  }, [activeTeam, activeInstance, refresh]);

  // Copy helper
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  // Stabilise callback ref so HlsPlayer doesn't remount
  const handleStatusChange = useCallback((s: StreamStatus) => {
    setStreamStatus(s);
  }, []);

  // ── No instance guard ──
  if (!activeInstance) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground py-20">
        <AlertCircle className="h-5 w-5 mr-2" />
        No instance selected
      </div>
    );
  }

  // ── Status badge ──
  const statusConfig: Record<
    StreamStatus,
    { label: string; variant: "default" | "destructive" | "secondary" | "outline" }
  > = {
    live: { label: "Live", variant: "default" },
    loading: { label: "Connecting…", variant: "secondary" },
    offline: { label: "Offline", variant: "destructive" },
    "no-url": { label: "Not Configured", variant: "outline" },
  };
  const badge = statusConfig[hlsUrl ? streamStatus : "no-url"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Stream Preview</h2>
          <p className="text-muted-foreground text-sm">
            Watch the live OBS output for{" "}
            <span className="font-medium text-foreground">
              {activeInstance.name}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {streamStatus === "live" && viewers !== null && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>{viewers}</span>
            </div>
          )}
          <Badge variant={badge.variant} className="gap-1.5 text-xs">
          {streamStatus === "live" && (
            <Radio className="h-3 w-3 animate-pulse" />
          )}
          {streamStatus === "loading" && (
            <Loader2 className="h-3 w-3 animate-spin" />
          )}
          {badge.label}
          </Badge>
        </div>
      </div>

      {/* Video Player */}
      <Card className="overflow-hidden">
        <div className="relative aspect-video bg-black">
          {hlsUrl ? (
            <HlsPlayer url={hlsUrl} onStatusChange={handleStatusChange} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <Tv className="h-16 w-16 opacity-30" />
              <p className="text-sm">No HLS stream URL configured</p>
              {canManageContent && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startEditing}
                >
                  <Settings2 className="h-4 w-4 mr-1.5" />
                  Configure Stream URL
                </Button>
              )}
            </div>
          )}

          {/* Offline overlay for configured but offline stream */}
          {hlsUrl && streamStatus === "offline" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-muted-foreground gap-3">
              <XCircle className="h-12 w-12 opacity-50" />
              <p className="text-sm font-medium">Stream Offline</p>
              <p className="text-xs opacity-75">
                Retrying automatically every 10 seconds…
              </p>
            </div>
          )}

          {/* Loading overlay */}
          {hlsUrl && streamStatus === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-muted-foreground gap-3">
              <Loader2 className="h-10 w-10 animate-spin opacity-50" />
              <p className="text-sm">Connecting to stream…</p>
            </div>
          )}
        </div>
      </Card>

      {/* Configuration Section */}
      {canManageContent && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Stream Configuration
            </CardTitle>
            <CardDescription>
              Configure the HLS stream URL for this instance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {editingUrl ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="hls-url">HLS Stream URL</Label>
                  <Input
                    id="hls-url"
                    placeholder="http://your-server:8888/live/stream/index.m3u8"
                    value={urlDraft}
                    onChange={(e) => setUrlDraft(e.target.value)}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    The full URL to the HLS playlist (.m3u8) served by MediaMTX
                    or another RTMP-to-HLS relay.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={saveUrl}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    ) : (
                      <Save className="h-4 w-4 mr-1.5" />
                    )}
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingUrl(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  {hlsUrl && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={clearUrl}
                      disabled={saving}
                      className="ml-auto"
                    >
                      Remove URL
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {hlsUrl ? (
                  <>
                    <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md truncate">
                      {hlsUrl}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(hlsUrl)}
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button size="sm" variant="outline" onClick={startEditing}>
                      Edit
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={startEditing}>
                    <Settings2 className="h-4 w-4 mr-1.5" />
                    Set HLS URL
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* OBS Setup Instructions */}
      <Collapsible>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    OBS → HLS Setup Guide
                  </CardTitle>
                  <CardDescription>
                    How to relay your OBS output to the web dashboard
                  </CardDescription>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div className="space-y-3 text-sm">
                <div>
                  <h4 className="font-semibold mb-1">1. Install MediaMTX</h4>
                  <p className="text-muted-foreground">
                    Download{" "}
                    <a
                      href="https://github.com/bluenviron/mediamtx/releases"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      MediaMTX
                    </a>{" "}
                    (single binary, no install needed). Extract and run it —
                    default config works out of the box.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-1">
                    2. Configure OBS Custom RTMP Output
                  </h4>
                  <p className="text-muted-foreground mb-2">
                    In OBS go to{" "}
                    <span className="font-mono text-foreground">
                      Settings → Stream
                    </span>
                    :
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="w-24 shrink-0 text-xs">Service:</Label>
                      <code className="flex-1 text-xs bg-muted px-2 py-1 rounded">
                        Custom...
                      </code>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="w-24 shrink-0 text-xs">Server:</Label>
                      <div className="flex-1 flex items-center gap-1">
                        <code className="flex-1 text-xs bg-muted px-2 py-1 rounded">
                          rtmp://localhost:1935/live
                        </code>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() =>
                            copyToClipboard("rtmp://localhost:1935/live")
                          }
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="w-24 shrink-0 text-xs">
                        Stream Key:
                      </Label>
                      <div className="flex-1 flex items-center gap-1">
                        <code className="flex-1 text-xs bg-muted px-2 py-1 rounded">
                          stream
                        </code>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard("stream")}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-1">
                    3. Set the HLS URL above
                  </h4>
                  <p className="text-muted-foreground mb-2">
                    Once MediaMTX is running and OBS is streaming, configure the
                    HLS URL:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted px-2 py-1 rounded">
                      http://localhost:8888/live/stream/index.m3u8
                    </code>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() =>
                        copyToClipboard(
                          "http://localhost:8888/live/stream/index.m3u8"
                        )
                      }
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-1">4. Remote Access</h4>
                  <p className="text-muted-foreground">
                    If team members access the dashboard remotely, replace{" "}
                    <code className="text-xs">localhost</code> with your
                    machine&apos;s public IP / domain, and make sure port{" "}
                    <code className="text-xs">8888</code> is accessible. You may
                    also need to add CORS headers in the MediaMTX config (
                    <code className="text-xs">hlsAllowOrigin</code>).
                  </p>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
