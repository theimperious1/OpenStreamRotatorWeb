"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
import { Save, Loader2, Eye, EyeOff, Lock, AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

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
  const { activeInstance: instance } = useTeam();
  const { canManageContent, isOwner } = useMyRole();
  const { state, sendCommand, connected, lastAck } = useInstanceWs();

  const remoteSettings = state?.settings;
  const connections = state?.connections;

  // Local draft state for editable fields — seed from current remote to avoid flash
  const [draft, setDraft] = useState<OsrSettings>(() => remoteSettings ?? {});
  const [dirty, setDirty] = useState(false);
  const [envDraft, setEnvDraft] = useState<Record<string, string>>({});
  const saveTimestampRef = useRef(0);

  const updateEnvDraft = useCallback((key: string, value: string) => {
    setEnvDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Button is enabled purely based on user edits — no delays
  const anyDirty = dirty || Object.keys(envDraft).length > 0;

  // Title truncation warning — worst-case check
  const MAX_TITLE_LENGTH = 140;
  const titleWarning = useMemo(() => {
    const template = draft.stream_title_template ?? "";
    if (!template.includes("{GAMES}")) return null;
    const playlists = state?.playlists ?? [];
    const enabled = playlists.filter((p) => p.enabled);
    if (enabled.length === 0) return null;
    const maxPerRotation = Number(draft.max_playlists_per_rotation) || enabled.length;
    const n = Math.min(maxPerRotation, enabled.length);
    // Pick the N longest playlist names
    const longest = [...enabled]
      .sort((a, b) => b.name.length - a.name.length)
      .slice(0, n)
      .map((p) => p.name.toUpperCase());
    const gamesStr = longest.join(" | ");
    const worstTitle = template.replace("{GAMES}", gamesStr);
    if (worstTitle.length > MAX_TITLE_LENGTH) {
      return { length: worstTitle.length, preview: worstTitle };
    }
    return null;
  }, [draft.stream_title_template, draft.max_playlists_per_rotation, state?.playlists]);

  // Sync remote settings into local draft when they arrive, but skip for
  // 3 seconds after a save to prevent stale server data from overwriting
  // what we just sent.
  useEffect(() => {
    if (!remoteSettings) return;
    const sinceSave = Date.now() - saveTimestampRef.current;
    if (!dirty && sinceSave > 3000) {
      setDraft(remoteSettings);
    }
  }, [remoteSettings]); // eslint-disable-line react-hooks/exhaustive-deps

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
    saveTimestampRef.current = Date.now();
    setDirty(false);
    setEnvDraft({});
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
          {state && state.status !== "offline" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="text-green-500 border-green-500/30 cursor-help"
                >
                  Connected
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Real-time connection to OSR instance is active</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="text-gray-500 border-gray-500/20 cursor-help"
                >
                  Disconnected
                </Badge>
              </TooltipTrigger>
              <TooltipContent>No OSR instance is connected</TooltipContent>
            </Tooltip>
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
                {!canManageContent && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="ml-2 text-[10px] cursor-help">
                        <Lock className="h-3 w-3 mr-0.5 inline" />
                        Content Manager+
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>Only content managers and admins can edit these settings</TooltipContent>
                  </Tooltip>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <SettingRow
                label="Stream Title Template"
                description="Use {GAMES} for playlist names. Applied each rotation."
              >
                <div className="space-y-1.5">
                  <Input
                    value={draft.stream_title_template ?? ""}
                    onChange={(e) =>
                      updateDraft("stream_title_template", e.target.value)
                    }
                    disabled={!canManageContent}
                    className="w-[400px] text-sm"
                  />
                  {titleWarning && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 text-amber-500 text-xs cursor-help">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>Worst-case title is {titleWarning.length}/{MAX_TITLE_LENGTH} chars — playlist names may be truncated</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-md">
                        <p className="text-xs font-mono break-all">{titleWarning.preview}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
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
                {!canManageContent && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="ml-2 text-[10px] cursor-help">
                        <Lock className="h-3 w-3 mr-0.5 inline" />
                        Content Manager+
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>Only content managers and admins can edit these settings</TooltipContent>
                  </Tooltip>
                )}
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
                {!canManageContent && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="ml-2 text-[10px] cursor-help">
                        <Lock className="h-3 w-3 mr-0.5 inline" />
                        Content Manager+
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>Only content managers and admins can edit these settings</TooltipContent>
                  </Tooltip>
                )}
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
            envDraft={envDraft}
            onEnvChange={updateEnvDraft}
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
  envDraft,
  onEnvChange,
}: {
  envConfig?: EnvConfig;
  connections?: { obs: boolean; twitch: boolean; kick: boolean; discord_webhook: boolean; twitch_enabled: boolean; kick_enabled: boolean };
  connected: boolean;
  isOwner: boolean;
  envDraft: Record<string, string>;
  onEnvChange: (key: string, value: string) => void;
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="ml-2 text-[10px] cursor-help">
                        <Lock className="h-3 w-3 mr-0.5 inline" />
                        Admin only
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>Only team admins can edit these settings</TooltipContent>
                  </Tooltip>
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="ml-2 text-[10px] cursor-help">
                        <Lock className="h-3 w-3 mr-0.5 inline" />
                        Admin only
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>Only team admins can edit these settings</TooltipContent>
                  </Tooltip>
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="ml-2 text-[10px] cursor-help">
                        <Lock className="h-3 w-3 mr-0.5 inline" />
                        Admin only
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>Only team admins can edit these settings</TooltipContent>
                  </Tooltip>
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="ml-2 text-[10px] cursor-help">
                        <Lock className="h-3 w-3 mr-0.5 inline" />
                        Admin only
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>Only team admins can edit these settings</TooltipContent>
                  </Tooltip>
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

  // Sync from remote when not editing (render-time adjustment)
  const [prevRemoteValue, setPrevRemoteValue] = useState(remoteValue);
  if (remoteValue !== prevRemoteValue) {
    setPrevRemoteValue(remoteValue);
    if (!editing && !isSecret) {
      setLocalValue(remoteValue);
    }
  }

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
