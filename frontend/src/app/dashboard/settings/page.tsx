"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { useTeam, useMyRole } from "@/lib/team-context";
import { useInstanceWs } from "@/lib/instance-ws-context";
import type { OsrSettings, EnvConfig } from "@/lib/instance-ws-context";
import { Save, Loader2, Eye, EyeOff, Lock } from "lucide-react";

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
  disabled,
}: {
  enabled: boolean;
  onToggle?: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant={enabled ? "default" : "outline"}
      size="sm"
      onClick={onToggle}
      disabled={disabled}
      className="w-16"
    >
      {enabled ? "On" : "Off"}
    </Button>
  );
}

export default function SettingsPage() {
  const { activeTeam } = useTeam();
  const { canManageContent, isOwner } = useMyRole();
  const instance = activeTeam?.instances?.[0] ?? null;
  const { state, sendCommand, connected, lastAck } = useInstanceWs();

  const remoteSettings = state?.settings;
  const connections = state?.connections;

  // Local draft state for editable fields
  const [draft, setDraft] = useState<OsrSettings>({});
  const [dirty, setDirty] = useState(false);
  const [envDraft, setEnvDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const skipNextSync = useRef(false);

  const updateEnvDraft = useCallback((key: string, value: string) => {
    setEnvDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const anyDirty = !saving && (dirty || Object.keys(envDraft).length > 0);

  // Sync remote settings into local draft when they first arrive or change.
  // After a save we skip one cycle so stale remote data doesn't overwrite the
  // draft. The NEXT state push (with server-confirmed values) syncs normally.
  useEffect(() => {
    if (remoteSettings && !dirty) {
      if (skipNextSync.current) {
        skipNextSync.current = false;
        return;
      }
      setDraft(remoteSettings);
      // Also clear any pending env edits & saving flag — remote has caught up
      if (saving) {
        setEnvDraft({});
        setSaving(false);
      }
    }
  }, [remoteSettings, dirty, saving]);

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
    // Send every changed settings.json key
    const keys = Object.keys(draft) as (keyof OsrSettings)[];
    for (const key of keys) {
      if (
        remoteSettings &&
        JSON.stringify(draft[key]) !== JSON.stringify(remoteSettings[key])
      ) {
        sendSetting(key, draft[key]);
      }
    }
    // Send every changed env var
    for (const [key, value] of Object.entries(envDraft)) {
      sendCommand("update_env", { key, value });
    }
    skipNextSync.current = true;
    setSaving(true);
    setDirty(false);
    // envDraft is NOT cleared here — keeps merged config showing pending values
    // until the server responds and the sync effect clears it
  }

  function handleToggle(key: keyof OsrSettings) {
    updateDraft(key, !draft[key]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">
            Configure your OSR instance. Press Save to apply changes.
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
          <Button size="sm" onClick={handleSaveAll} disabled={!anyDirty || !canManageContent}>
            {anyDirty ? (
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
                  disabled={!canManageContent}
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
                  disabled={!canManageContent}
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
                  disabled={!canManageContent}
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
                  disabled={!canManageContent}
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
                  disabled={!canManageContent}
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
                  disabled={!canManageContent}
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
                  disabled={!canManageContent}
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
                  disabled={!canManageContent}
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
                  disabled={!canManageContent}
                />
              </SettingRow>
            </CardContent>
          </Card>

          {/* Environment Configuration */}
          <EnvironmentSection
            envConfig={state?.env_config}
            connections={connections}
            connected={connected}
            isOwner={isOwner}
            canManageContent={canManageContent}
            envDraft={envDraft}
            onEnvChange={updateEnvDraft}
            sendCommand={sendCommand}
          />
        </>
      )}
    </div>
  );
}

// ── Environment Configuration Section ────────

function EnvironmentSection({
  envConfig: rawEnvConfig,
  connections,
  connected,
  isOwner,
  canManageContent,
  envDraft,
  onEnvChange,
  sendCommand,
}: {
  envConfig?: EnvConfig;
  connections?: { obs: boolean; twitch: boolean; kick: boolean; discord_webhook: boolean; twitch_enabled: boolean; kick_enabled: boolean };
  connected: boolean;
  isOwner: boolean;
  canManageContent: boolean;
  envDraft: Record<string, string>;
  onEnvChange: (key: string, value: string) => void;
  sendCommand: (action: string, payload?: Record<string, unknown>) => void;
}) {
  const sendEnv = onEnvChange;

  // Merge draft values into envConfig so children display pending changes
  const envConfig = useMemo((): EnvConfig | undefined => {
    if (!rawEnvConfig) return rawEnvConfig;
    const merged: EnvConfig = { ...rawEnvConfig };
    for (const [key, value] of Object.entries(envDraft)) {
      if (key in merged) {
        merged[key] = merged[key].secret
          ? { value: "pending", secret: true }
          : { value, secret: false };
      }
    }
    return merged;
  }, [rawEnvConfig, envDraft]);

  return (
    <>
      {/* OBS Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">OBS Configuration</CardTitle>
              <CardDescription>
                OBS WebSocket connection and scene names
                {!isOwner && (
                  <Badge variant="secondary" className="ml-2 text-[10px]">
                    <Lock className="h-3 w-3 mr-0.5 inline" />
                    Owner only
                  </Badge>
                )}
              </CardDescription>
            </div>
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
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          <EnvRow
            label="OBS Host"
            envKey="OBS_HOST"
            description="IP address of the OBS WebSocket server"
            envConfig={envConfig}
            disabled={!isOwner || !connected}
            onSave={sendEnv}
          />
          <Separator />
          <EnvRow
            label="OBS Port"
            envKey="OBS_PORT"
            description="Port number for OBS WebSocket"
            envConfig={envConfig}
            disabled={!isOwner || !connected}
            onSave={sendEnv}
            inputType="number"
          />
          <Separator />
          <EnvRow
            label="OBS Password"
            envKey="OBS_PASSWORD"
            description="OBS WebSocket authentication password"
            envConfig={envConfig}
            disabled={!isOwner || !connected}
            onSave={sendEnv}
          />
          <Separator />
          <EnvRow
            label="Pause Scene"
            envKey="SCENE_PAUSE"
            description='Scene shown when stream is paused (e.g. "LIVE")'
            envConfig={envConfig}
            disabled={!isOwner || !connected}
            onSave={sendEnv}
          />
          <Separator />
          <EnvRow
            label="Stream Scene"
            envKey="SCENE_STREAM"
            description='Scene shown during normal playback (e.g. "OFFLINE")'
            envConfig={envConfig}
            disabled={!isOwner || !connected}
            onSave={sendEnv}
          />
          <Separator />
          <EnvRow
            label="Rotation Screen Scene"
            envKey="SCENE_ROTATION_SCREEN"
            description="Scene shown during rotation transitions"
            envConfig={envConfig}
            disabled={!isOwner || !connected}
            onSave={sendEnv}
          />
          <Separator />
          <EnvRow
            label="VLC Source Name"
            envKey="VLC_SOURCE_NAME"
            description="Name of the VLC media source in OBS"
            envConfig={envConfig}
            disabled={!isOwner || !connected}
            onSave={sendEnv}
          />
        </CardContent>
      </Card>

      {/* Twitch Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Twitch</CardTitle>
              <CardDescription>
                Twitch API credentials and live detection
                {!isOwner && (
                  <Badge variant="secondary" className="ml-2 text-[10px]">
                    <Lock className="h-3 w-3 mr-0.5 inline" />
                    Owner only
                  </Badge>
                )}
              </CardDescription>
            </div>
            <ConnectionBadge
              configured={connections?.twitch ?? false}
              enabled={connections?.twitch_enabled ?? false}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          <EnvToggleRow
            label="Enable Twitch"
            envKey="ENABLE_TWITCH"
            description="Enable Twitch live detection and category updates"
            envConfig={envConfig}
            disabled={!isOwner || !connected}
            onSave={sendEnv}
          />
          <Separator />
          <EnvRow
            label="Target Streamer"
            envKey="TARGET_TWITCH_STREAMER"
            description="Twitch username to monitor for live status"
            envConfig={envConfig}
            disabled={!isOwner || !connected}
            onSave={sendEnv}
          />
          <Separator />
          <EnvRow
            label="Client ID"
            envKey="TWITCH_CLIENT_ID"
            description="Twitch application Client ID"
            envConfig={envConfig}
            disabled={!isOwner || !connected}
            onSave={sendEnv}
          />
          <Separator />
          <EnvRow
            label="Client Secret"
            envKey="TWITCH_CLIENT_SECRET"
            description="Twitch application Client Secret"
            envConfig={envConfig}
            disabled={!isOwner || !connected}
            onSave={sendEnv}
          />
        </CardContent>
      </Card>

      {/* Kick Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Kick</CardTitle>
              <CardDescription>
                Kick API credentials and live detection
                {!isOwner && (
                  <Badge variant="secondary" className="ml-2 text-[10px]">
                    <Lock className="h-3 w-3 mr-0.5 inline" />
                    Owner only
                  </Badge>
                )}
              </CardDescription>
            </div>
            <ConnectionBadge
              configured={connections?.kick ?? false}
              enabled={connections?.kick_enabled ?? false}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          <EnvToggleRow
            label="Enable Kick"
            envKey="ENABLE_KICK"
            description="Enable Kick live detection and category updates"
            envConfig={envConfig}
            disabled={!isOwner || !connected}
            onSave={sendEnv}
          />
          <Separator />
          <EnvRow
            label="Target Streamer"
            envKey="TARGET_KICK_STREAMER"
            description="Kick channel to monitor for live status"
            envConfig={envConfig}
            disabled={!isOwner || !connected}
            onSave={sendEnv}
          />
          <Separator />
          <EnvRow
            label="Client ID"
            envKey="KICK_CLIENT_ID"
            description="Kick application Client ID"
            envConfig={envConfig}
            disabled={!isOwner || !connected}
            onSave={sendEnv}
          />
          <Separator />
          <EnvRow
            label="Client Secret"
            envKey="KICK_CLIENT_SECRET"
            description="Kick application Client Secret"
            envConfig={envConfig}
            disabled={!isOwner || !connected}
            onSave={sendEnv}
          />
        </CardContent>
      </Card>

      {/* Discord Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Discord</CardTitle>
              <CardDescription>
                Webhook for notifications
                {!isOwner && (
                  <Badge variant="secondary" className="ml-2 text-[10px]">
                    <Lock className="h-3 w-3 mr-0.5 inline" />
                    Owner only
                  </Badge>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <EnvRow
            label="Webhook URL"
            envKey="DISCORD_WEBHOOK_URL"
            description="Discord webhook URL for sending notifications"
            envConfig={envConfig}
            disabled={!isOwner || !connected}
            onSave={sendEnv}
            wide
          />
        </CardContent>
      </Card>
    </>
  );
}

// ── Env Row (text input with save-on-blur) ───

function EnvRow({
  label,
  envKey,
  description,
  envConfig,
  disabled,
  onSave,
  inputType = "text",
  wide = false,
}: {
  label: string;
  envKey: string;
  description: string;
  envConfig?: EnvConfig;
  disabled: boolean;
  onSave: (key: string, value: string) => void;
  inputType?: "text" | "number";
  wide?: boolean;
}) {
  const entry = envConfig?.[envKey];
  const isSecret = entry?.secret ?? false;
  const remoteValue = isSecret ? "" : String(entry?.value ?? "");
  const isModified = isSecret && typeof entry?.value === "string";
  const isConfigured = isSecret ? !!entry?.value : false;

  const [localValue, setLocalValue] = useState(remoteValue);
  const [editing, setEditing] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // Sync from remote when not editing
  useEffect(() => {
    if (!editing && !isSecret) {
      setLocalValue(remoteValue);
    }
  }, [remoteValue, editing, isSecret]);

  const handleSave = useCallback(() => {
    if (disabled) return;
    const trimmed = localValue.trim();
    if (isSecret && !trimmed) {
      // Don't send empty string for secrets (user just cancelled)
      setEditing(false);
      setLocalValue("");
      return;
    }
    if (!isSecret && trimmed === remoteValue) {
      setEditing(false);
      return;
    }
    onSave(envKey, trimmed);
    setEditing(false);
    if (isSecret) setLocalValue("");
  }, [disabled, localValue, remoteValue, isSecret, envKey, onSave]);

  if (isSecret && !editing) {
    return (
      <SettingRow label={label} description={description}>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={
              isModified
                ? "text-yellow-500 border-yellow-500/30"
                : isConfigured
                  ? "text-green-500 border-green-500/30"
                  : "text-gray-500 border-gray-500/30"
            }
          >
            {isModified ? "Modified (unsaved)" : isConfigured ? "Configured" : "Not set"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
            disabled={disabled}
            className="text-xs"
          >
            Change
          </Button>
        </div>
      </SettingRow>
    );
  }

  return (
    <SettingRow label={label} description={description}>
      <div className="flex items-center gap-2">
        <Input
          type={isSecret && !showSecret ? "password" : inputType}
          value={localValue}
          placeholder={isSecret ? "Enter new value…" : ""}
          onChange={(e) => {
            setLocalValue(e.target.value);
            if (!editing) setEditing(true);
          }}
          onBlur={() => {
            // Small delay so click on Save/Cancel registers first
            setTimeout(() => {
              if (!isSecret && editing) handleSave();
            }, 150);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") {
              setEditing(false);
              if (isSecret) setLocalValue("");
              else setLocalValue(remoteValue);
            }
          }}
          disabled={disabled}
          className={`text-sm ${wide ? "w-[400px]" : "w-48"}`}
          autoFocus={isSecret && editing}
        />
        {isSecret && editing && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowSecret((s) => !s)}
            >
              {showSecret ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button size="sm" className="text-xs" onClick={handleSave}>
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                setEditing(false);
                setLocalValue("");
              }}
            >
              Cancel
            </Button>
          </>
        )}
      </div>
    </SettingRow>
  );
}

// ── Env Toggle Row (for ENABLE_TWITCH, ENABLE_KICK) ─

function EnvToggleRow({
  label,
  envKey,
  description,
  envConfig,
  disabled,
  onSave,
}: {
  label: string;
  envKey: string;
  description: string;
  envConfig?: EnvConfig;
  disabled: boolean;
  onSave: (key: string, value: string) => void;
}) {
  const entry = envConfig?.[envKey];
  const enabled = String(entry?.value ?? "").toLowerCase() === "true";

  return (
    <SettingRow label={label} description={description}>
      <ToggleButton
        enabled={enabled}
        onToggle={() => onSave(envKey, enabled ? "false" : "true")}
        disabled={disabled}
      />
    </SettingRow>
  );
}

// ── Connection badge ──

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
