"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTeam } from "@/lib/team-context";
import { useInstanceWs } from "@/hooks/use-instance-ws";
import type { OsrSettings } from "@/hooks/use-instance-ws";
import { Save, Loader2 } from "lucide-react";

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0 ml-4">{children}</div>
    </div>
  );
}

function ToggleButton({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle?: () => void;
}) {
  return (
    <Button
      variant={enabled ? "default" : "outline"}
      size="sm"
      onClick={onToggle}
      className="w-16"
    >
      {enabled ? "On" : "Off"}
    </Button>
  );
}

export default function SettingsPage() {
  const { activeTeam } = useTeam();
  const instance = activeTeam?.instances?.[0] ?? null;
  const { state, sendCommand, connected, lastAck } = useInstanceWs(instance?.id ?? null);

  const remoteSettings = state?.settings;
  const connections = state?.connections;

  // Local draft state for editable fields
  const [draft, setDraft] = useState<OsrSettings>({});
  const [dirty, setDirty] = useState(false);

  // Sync remote settings into local draft when they first arrive or change
  useEffect(() => {
    if (remoteSettings && !dirty) {
      setDraft(remoteSettings);
    }
  }, [remoteSettings, dirty]);

  const updateDraft = useCallback(
    (key: keyof OsrSettings, value: OsrSettings[keyof OsrSettings]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
      setDirty(true);
    },
    []
  );

  const sendSetting = useCallback(
    (key: string, value: unknown) => {
      sendCommand("update_setting", { key, value });
    },
    [sendCommand]
  );

  function handleSaveAll() {
    // Send every changed key
    const keys = Object.keys(draft) as (keyof OsrSettings)[];
    for (const key of keys) {
      if (
        remoteSettings &&
        JSON.stringify(draft[key]) !== JSON.stringify(remoteSettings[key])
      ) {
        sendSetting(key, draft[key]);
      }
    }
    setDirty(false);
  }

  function handleToggle(key: keyof OsrSettings) {
    const newVal = !draft[key];
    updateDraft(key, newVal);
    // Toggles apply immediately
    sendSetting(key, newVal);
    setDirty(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">
            Configure your OSR instance. Toggle changes apply immediately.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <Badge
              variant="outline"
              className="text-green-500 border-green-500/20"
            >
              Connected
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-gray-500 border-gray-500/20"
            >
              Disconnected
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
          <Button size="sm" onClick={handleSaveAll} disabled={!dirty}>
            {dirty ? (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            ) : (
              "Saved"
            )}
          </Button>
        </div>
      </div>

      {!connected && !remoteSettings ? (
        <Card>
          <CardContent className="py-12 text-center">
            {instance ? (
              <div className="space-y-2">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Waiting for OSR instance to connect...
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No OSR instance registered. Create one on the Team page.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stream Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stream</CardTitle>
              <CardDescription>
                General stream behavior settings
                <Badge variant="outline" className="ml-2 text-[10px]">
                  Hot-swappable
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <SettingRow
                label="Stream Title Template"
                description="Use {GAMES} for playlist names. Applied each rotation."
              >
                <Input
                  value={draft.stream_title_template ?? ""}
                  onChange={(e) =>
                    updateDraft("stream_title_template", e.target.value)
                  }
                  className="w-[400px] text-sm"
                />
              </SettingRow>
              <Separator />
              <SettingRow
                label="Debug Mode"
                description="Ignores live detection — stream never pauses"
              >
                <ToggleButton
                  enabled={!!draft.debug_mode}
                  onToggle={() => handleToggle("debug_mode")}
                />
              </SettingRow>
              <Separator />
              <SettingRow
                label="Notify Video Transitions"
                description="Send Discord notification on every video change"
              >
                <ToggleButton
                  enabled={!!draft.notify_video_transitions}
                  onToggle={() => handleToggle("notify_video_transitions")}
                />
              </SettingRow>
            </CardContent>
          </Card>

          {/* Rotation Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rotation</CardTitle>
              <CardDescription>
                Playlist selection per rotation cycle
                <Badge variant="outline" className="ml-2 text-[10px]">
                  Hot-swappable
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <SettingRow
                label="Min Playlists Per Rotation"
                description="Minimum playlists selected each rotation"
              >
                <Input
                  type="number"
                  value={draft.min_playlists_per_rotation ?? ""}
                  onChange={(e) =>
                    updateDraft(
                      "min_playlists_per_rotation",
                      parseInt(e.target.value) || 1
                    )
                  }
                  min={1}
                  max={10}
                  className="w-20 text-sm text-center"
                />
              </SettingRow>
              <Separator />
              <SettingRow
                label="Max Playlists Per Rotation"
                description="Maximum playlists selected each rotation"
              >
                <Input
                  type="number"
                  value={draft.max_playlists_per_rotation ?? ""}
                  onChange={(e) =>
                    updateDraft(
                      "max_playlists_per_rotation",
                      parseInt(e.target.value) || 1
                    )
                  }
                  min={1}
                  max={10}
                  className="w-20 text-sm text-center"
                />
              </SettingRow>
            </CardContent>
          </Card>

          {/* Download Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Downloads</CardTitle>
              <CardDescription>
                yt-dlp and download behavior
                <Badge variant="outline" className="ml-2 text-[10px]">
                  Hot-swappable
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <SettingRow
                label="Download Retry Attempts"
                description="Retries per failed video download"
              >
                <Input
                  type="number"
                  value={draft.download_retry_attempts ?? ""}
                  onChange={(e) =>
                    updateDraft(
                      "download_retry_attempts",
                      parseInt(e.target.value) || 1
                    )
                  }
                  min={1}
                  max={20}
                  className="w-20 text-sm text-center"
                />
              </SettingRow>
              <Separator />
              <SettingRow
                label="Use Browser Cookies"
                description="Use cookies for age-restricted videos. Toggle mid-retry to fix 403 errors."
              >
                <ToggleButton
                  enabled={!!draft.yt_dlp_use_cookies}
                  onToggle={() => handleToggle("yt_dlp_use_cookies")}
                />
              </SettingRow>
              <Separator />
              <SettingRow
                label="Cookie Browser"
                description="Browser to extract cookies from"
              >
                <Input
                  value={draft.yt_dlp_browser_for_cookies ?? ""}
                  onChange={(e) =>
                    updateDraft("yt_dlp_browser_for_cookies", e.target.value)
                  }
                  className="w-32 text-sm"
                />
              </SettingRow>
              <Separator />
              <SettingRow
                label="Verbose yt-dlp Output"
                description="Show detailed download logs"
              >
                <ToggleButton
                  enabled={!!draft.yt_dlp_verbose}
                  onToggle={() => handleToggle("yt_dlp_verbose")}
                />
              </SettingRow>
            </CardContent>
          </Card>

          {/* Platform Connections — Read Only */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Platform Connections</CardTitle>
              <CardDescription>
                Configured in .env on the host machine. Shown here for
                reference.
                <Badge variant="secondary" className="ml-2 text-[10px]">
                  Read-only
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <SettingRow
                label="Twitch"
                description="ENABLE_TWITCH, TWITCH_CLIENT_ID, TARGET_TWITCH_STREAMER"
              >
                <ConnectionBadge
                  configured={connections?.twitch ?? false}
                  enabled={connections?.twitch_enabled ?? false}
                />
              </SettingRow>
              <Separator />
              <SettingRow
                label="Kick"
                description="ENABLE_KICK, KICK_CLIENT_ID, TARGET_KICK_STREAMER"
              >
                <ConnectionBadge
                  configured={connections?.kick ?? false}
                  enabled={connections?.kick_enabled ?? false}
                />
              </SettingRow>
              <Separator />
              <SettingRow
                label="Discord Webhook"
                description="DISCORD_WEBHOOK_URL"
              >
                <Badge
                  variant="outline"
                  className={
                    connections?.discord_webhook
                      ? "text-green-500 border-green-500/30"
                      : "text-gray-500 border-gray-500/30"
                  }
                >
                  {connections?.discord_webhook ? "Configured" : "Not set"}
                </Badge>
              </SettingRow>
              <Separator />
              <SettingRow
                label="OBS WebSocket"
                description="OBS_HOST, OBS_PORT, OBS_PASSWORD"
              >
                <Badge
                  variant="outline"
                  className={
                    connections?.obs
                      ? "text-green-500 border-green-500/30"
                      : "text-red-500 border-red-500/30"
                  }
                >
                  {connections?.obs ? "Connected" : "Disconnected"}
                </Badge>
              </SettingRow>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ConnectionBadge({
  configured,
  enabled,
}: {
  configured: boolean;
  enabled: boolean;
}) {
  if (!configured) {
    return (
      <Badge variant="outline" className="text-gray-500 border-gray-500/30">
        Not configured
      </Badge>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <Badge
        variant="outline"
        className="text-green-500 border-green-500/30"
      >
        Credentials set
      </Badge>
      <Badge
        variant="outline"
        className={
          enabled
            ? "text-green-500 border-green-500/30"
            : "text-yellow-500 border-yellow-500/30"
        }
      >
        {enabled ? "Enabled" : "Disabled"}
      </Badge>
    </div>
  );
}
