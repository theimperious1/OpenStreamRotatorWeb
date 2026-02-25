"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useTeam, useMyRole } from "@/lib/team-context";
import { useInstanceWs } from "@/lib/instance-ws-context";
import type { PlaylistConfig } from "@/lib/instance-ws-context";
import {
  Music,
  ExternalLink,
  RefreshCw,
  Loader2,
  ArrowUpDown,
  Check,
  Plus,
  Trash2,
  Pencil,
  X,
  ToggleLeft,
  ToggleRight,
  Save,
  Undo2,
  AlertTriangle,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

// ── Helpers ──────────────────────────────────

/** Format a UTC timestamp string into a human-readable relative time. */
function formatLastPlayed(isoString: string | null | undefined): string {
  if (!isoString) return "Never";
  const then = new Date(isoString + (isoString.endsWith("Z") ? "" : "Z")); // ensure UTC
  const diff = Date.now() - then.getTime();
  if (diff < 0) return "Just now";
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h ago`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

/** Convert youtube.com/watch?v=...&list=... → youtube.com/playlist?list=... */
function normalizePlaylistUrl(url: string): string {
  try {
    const u = new URL(url);
    if (
      (u.hostname === "www.youtube.com" || u.hostname === "youtube.com") &&
      u.pathname === "/watch" &&
      u.searchParams.has("list")
    ) {
      return `https://www.youtube.com/playlist?list=${u.searchParams.get("list")}`;
    }
  } catch {
    // not a valid URL yet — leave as-is
  }
  return url;
}

/** Check whether a non-empty string is a valid HTTP(S) URL. */
function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Detect if a string looks like a pasted URL (for category / name fields). */
function looksLikeUrl(str: string): boolean {
  const t = str.trim().toLowerCase();
  if (!t) return false;
  return /^https?:\/\//.test(t) || /^www\./.test(t);
}

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

// ── Add Playlist Form ────────────────────────

interface PlaylistFormData {
  name: string;
  url: string;
  twitch_category: string;
  kick_category: string;
  priority: number;
}

const emptyForm: PlaylistFormData = {
  name: "",
  url: "",
  twitch_category: "Just Chatting",
  kick_category: "",
  priority: 1,
};

function AddPlaylistForm({
  allNames,
  onSubmit,
  onCancel,
}: {
  allNames: string[];
  onSubmit: (data: PlaylistFormData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<PlaylistFormData>(emptyForm);

  const nameConflict =
    form.name.trim() !== "" &&
    allNames.some((n) => n.toLowerCase() === form.name.trim().toLowerCase());
  const urlInvalid = form.url.trim() !== "" && !isValidUrl(form.url);
  const nameIsUrl = looksLikeUrl(form.name);
  const twitchIsUrl = looksLikeUrl(form.twitch_category);
  const kickIsUrl = looksLikeUrl(form.kick_category);
  const hasValidationError = urlInvalid || nameIsUrl || twitchIsUrl || kickIsUrl || nameConflict;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add New Playlist
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Name
          </label>
          <Input
            placeholder="e.g. MUSIC"
            value={form.name}
            onChange={(e) =>
              setForm((p) => ({ ...p, name: e.target.value }))
            }
            className={`text-sm ${nameConflict || nameIsUrl ? "border-red-500" : ""}`}
          />
          {nameConflict && (
            <p className="text-xs text-red-500 mt-1">A playlist with this name already exists</p>
          )}
          {nameIsUrl && (
            <p className="text-xs text-red-500 mt-1">Name should not be a URL</p>
          )}
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            YouTube Playlist URL
          </label>
          <Input
            placeholder="https://www.youtube.com/playlist?list=..."
            value={form.url}
            onChange={(e) => setForm((p) => ({ ...p, url: normalizePlaylistUrl(e.target.value) }))}
            className={`text-sm ${urlInvalid ? "border-red-500" : ""}`}
          />
          {urlInvalid && (
            <p className="text-xs text-red-500 mt-1">Enter a valid URL (https://...)</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Twitch Category
            </label>
            <Input
              placeholder="e.g. Just Chatting"
              value={form.twitch_category}
              onChange={(e) =>
                setForm((p) => ({ ...p, twitch_category: e.target.value }))
              }
              className={`text-sm ${twitchIsUrl ? "border-red-500" : ""}`}
            />
            {twitchIsUrl && (
              <p className="text-xs text-red-500 mt-1">Category should not be a URL</p>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Kick Category{" "}
              <span className="text-[10px] opacity-60">(if different)</span>
            </label>
            <Input
              placeholder="Leave blank to use Twitch category"
              value={form.kick_category}
              onChange={(e) =>
                setForm((p) => ({ ...p, kick_category: e.target.value }))
              }
              className={`text-sm ${kickIsUrl ? "border-red-500" : ""}`}
            />
            {kickIsUrl && (
              <p className="text-xs text-red-500 mt-1">Category should not be a URL</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-24">
            <label className="text-xs text-muted-foreground mb-1 block">
              Priority
            </label>
            <Input
              type="number"
              min={1}
              max={10}
              value={form.priority}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  priority: parseInt(e.target.value) || 1,
                }))
              }
              className="text-sm text-center"
            />
          </div>
          <div className="flex items-center gap-2 ml-auto pt-5">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => onSubmit(form)}
              disabled={!form.name.trim() || !form.url.trim() || hasValidationError}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Playlist
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Edit Playlist Inline ─────────────────────

function EditPlaylistForm({
  playlist,
  allNames,
  onSave,
  onCancel,
}: {
  playlist: PlaylistConfig;
  allNames: string[];
  onSave: (updates: { name: string; url: string; twitch_category: string; kick_category: string; priority: number }) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: playlist.name,
    url: playlist.url,
    twitch_category: playlist.twitch_category,
    kick_category: playlist.kick_category,
    priority: playlist.priority,
  });

  const nameConflict =
    form.name.trim() !== "" &&
    form.name.trim().toLowerCase() !== playlist.name.toLowerCase() &&
    allNames.some(
      (n) => n.toLowerCase() === form.name.trim().toLowerCase()
    );
  const urlInvalid = form.url.trim() !== "" && !isValidUrl(form.url);
  const nameIsUrl = looksLikeUrl(form.name);
  const twitchIsUrl = looksLikeUrl(form.twitch_category);
  const kickIsUrl = looksLikeUrl(form.kick_category);
  const hasValidationError = urlInvalid || nameIsUrl || twitchIsUrl || kickIsUrl || nameConflict;

  return (
    <Card className="border-yellow-500/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Pencil className="h-3.5 w-3.5" />
            Editing Playlist
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-7 w-7 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Name
          </label>
          <Input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className={`text-sm ${nameConflict || nameIsUrl ? "border-red-500" : ""}`}
          />
          {nameConflict && (
            <p className="text-xs text-red-500 mt-1">A playlist with this name already exists</p>
          )}
          {nameIsUrl && (
            <p className="text-xs text-red-500 mt-1">Name should not be a URL</p>
          )}
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            YouTube Playlist URL
          </label>
          <Input
            value={form.url}
            onChange={(e) => setForm((p) => ({ ...p, url: normalizePlaylistUrl(e.target.value) }))}
            className={`text-sm ${urlInvalid ? "border-red-500" : ""}`}
          />
          {urlInvalid && (
            <p className="text-xs text-red-500 mt-1">Enter a valid URL (https://...)</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Twitch Category
            </label>
            <Input
              value={form.twitch_category}
              onChange={(e) =>
                setForm((p) => ({ ...p, twitch_category: e.target.value }))
              }
              className={`text-sm ${twitchIsUrl ? "border-red-500" : ""}`}
            />
            {twitchIsUrl && (
              <p className="text-xs text-red-500 mt-1">Category should not be a URL</p>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Kick Category
            </label>
            <Input
              value={form.kick_category}
              onChange={(e) =>
                setForm((p) => ({ ...p, kick_category: e.target.value }))
              }
              className={`text-sm ${kickIsUrl ? "border-red-500" : ""}`}
            />
            {kickIsUrl && (
              <p className="text-xs text-red-500 mt-1">Category should not be a URL</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-24">
            <label className="text-xs text-muted-foreground mb-1 block">
              Priority
            </label>
            <Input
              type="number"
              min={1}
              max={10}
              value={form.priority}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  priority: parseInt(e.target.value) || 1,
                }))
              }
              className="text-sm text-center"
            />
          </div>
          <div className="flex items-center gap-2 ml-auto pt-5">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={hasValidationError || form.name.trim() === "" || form.url.trim() === ""}
              onClick={() => onSave({ ...form, name: form.name.trim() })}
            >
              Save
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Playlist Card ────────────────────────────

function PlaylistCard({
  playlist,
  isActive,
  connected,
  canControl,
  canManageContent,
  onToggle,
  onEdit,
  onDelete,
}: {
  playlist: PlaylistConfig;
  isActive: boolean;
  connected: boolean;
  canControl: boolean;
  canManageContent: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Card className={isActive ? "border-primary/50 bg-primary/5" : undefined}>
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
            <button
              onClick={onToggle}
              disabled={!connected || !canControl}
              className="hover:opacity-80 disabled:opacity-40 transition-colors"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    {playlist.enabled ? (
                      <ToggleRight className="h-7 w-7 text-green-500" />
                    ) : (
                      <ToggleLeft className="h-7 w-7 text-muted-foreground" />
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{playlist.enabled ? "Playlist enabled — click to disable" : "Playlist disabled — click to enable"}</TooltipContent>
              </Tooltip>
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="text-[10px] cursor-help">
                T: {playlist.twitch_category || "—"}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Twitch stream category</TooltipContent>
          </Tooltip>
          {playlist.kick_category && playlist.kick_category !== playlist.twitch_category && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="text-[10px] cursor-help">
                  K: {playlist.kick_category}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Kick stream category</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-help">
                <ArrowUpDown className="h-3 w-3" />
                <span>Priority {playlist.priority}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>Higher priority playlists are preferred during rotation</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>Last played: {formatLastPlayed(playlist.last_played)}</span>
          <span>·</span>
          <span>Play count: {playlist.play_count ?? 0}</span>
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
        <Separator />
        <div className="flex items-center gap-1 pt-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={onEdit}
            disabled={!connected || !canManageContent}
          >
            <Pencil className="h-3 w-3 mr-1" />
            Edit
          </Button>
          {confirmDelete ? (
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-xs text-red-500">Delete?</span>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs"
                onClick={onDelete}
              >
                Yes
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setConfirmDelete(false)}
              >
                No
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs ml-auto text-muted-foreground hover:text-red-500"
              onClick={() => setConfirmDelete(true)}
              disabled={!connected || !canManageContent}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Remove
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ─────────────────────────────────────

/** Deep-compare two playlist arrays by serialising to JSON. */
function playlistsEqual(a: PlaylistConfig[], b: PlaylistConfig[]): boolean {
  if (a.length !== b.length) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function PlaylistsPage() {
  const { activeInstance: instance, loading: teamLoading } = useTeam();
  const { canControl, canManageContent } = useMyRole();
  const { state, sendCommand, connected } = useInstanceWs();

  const serverPlaylists = useMemo(() => state?.playlists ?? [], [state?.playlists]);
  const settings = state?.settings;
  const currentPlaylist = state?.current_playlist ?? null;
  const canTriggerRotation = state?.can_trigger_rotation ?? true;

  // ── Local working copy ───────────────────────
  interface LocalState {
    playlists: PlaylistConfig[];
    initialized: boolean;
    pendingSync: boolean;
    renameMap: Record<string, string>;
    showAddForm: boolean;
    editingName: string | null;
    // Track previous server values for change detection (avoids refs during render)
    _prevServerPlaylists: PlaylistConfig[];
    _prevStatus: string | undefined;
  }
  const initialLocalState: LocalState = {
    playlists: [],
    initialized: false,
    pendingSync: false,
    renameMap: {},
    showAddForm: false,
    editingName: null,
    _prevServerPlaylists: [],
    _prevStatus: undefined,
  };
  const [local, setLocal] = useState<LocalState>(initialLocalState);
  const [saving, setSaving] = useState(false);

  // Convenience accessors
  const localPlaylists = local.playlists;
  const initialized = local.initialized;
  const renameMap = local.renameMap;
  const showAddForm = local.showAddForm;
  const editingName = local.editingName;

  // Convenience setters (single-key updates)
  const setLocalPlaylists = useCallback((v: PlaylistConfig[] | ((prev: PlaylistConfig[]) => PlaylistConfig[])) => {
    setLocal((prev) => ({ ...prev, playlists: typeof v === "function" ? v(prev.playlists) : v }));
  }, []);
  const setRenameMap = useCallback((v: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => {
    setLocal((prev) => ({ ...prev, renameMap: typeof v === "function" ? v(prev.renameMap) : v }));
  }, []);
  const setPendingSync = useCallback((v: boolean) => setLocal((prev) => ({ ...prev, pendingSync: v })), []);
  const setShowAddForm = useCallback((v: boolean) => setLocal((prev) => ({ ...prev, showAddForm: v })), []);
  const setEditingName = useCallback((v: string | null) => setLocal((prev) => ({ ...prev, editingName: v })), []);

  // Sync from server — render-time state adjustment (React docs: "adjusting state when props change")
  // When the updater returns prev unchanged, React bails out with no extra render.
  if (state?.status !== local._prevStatus || serverPlaylists !== local._prevServerPlaylists) {
    setLocal((prev) => {
      const base = { ...prev, _prevServerPlaylists: serverPlaylists, _prevStatus: state?.status };
      const isOffline = !state || state.status === "offline";
      if (isOffline) return { ...initialLocalState, _prevServerPlaylists: serverPlaylists, _prevStatus: state?.status };
      if (!prev.initialized) {
        return { ...base, playlists: serverPlaylists, initialized: true, renameMap: {} };
      }
      if (prev.pendingSync) {
        return { ...base, playlists: serverPlaylists, pendingSync: false };
      }
      if (playlistsEqual(prev.playlists, serverPlaylists) && Object.keys(prev.renameMap).length === 0) {
        return { ...base, playlists: serverPlaylists };
      }
      return base;
    });
  }

  const hasChanges = initialized && (!playlistsEqual(localPlaylists, serverPlaylists) || Object.keys(renameMap).length > 0);

  // Minimum enabled playlists check — need enough for current + next rotation
  const minPerRotation = Number(settings?.min_playlists_per_rotation) || 2;
  const enabledCount = localPlaylists.filter((p) => p.enabled).length;
  const minEnabledRequired = minPerRotation * 2;
  const notEnoughPlaylists = initialized && enabledCount < minEnabledRequired;

  // Title truncation warning — worst-case check using local (possibly edited) playlists
  const MAX_TITLE_LENGTH = 140;
  const titleWarning = useMemo(() => {
    const template = settings?.stream_title_template ?? "";
    if (!template.includes("{GAMES}")) return null;
    const enabled = localPlaylists.filter((p) => p.enabled);
    if (enabled.length === 0) return null;
    const maxPerRotation = Number(settings?.max_playlists_per_rotation) || enabled.length;
    const n = Math.min(maxPerRotation, enabled.length);
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
  }, [settings?.stream_title_template, settings?.max_playlists_per_rotation, localPlaylists]);

  // ── Local mutations (no server calls) ────────
  const handleAdd = useCallback(
    (data: PlaylistFormData) => {
      const newPlaylist: PlaylistConfig = {
        name: data.name,
        url: data.url,
        twitch_category: data.twitch_category,
        kick_category: data.kick_category,
        priority: data.priority,
        enabled: true,
      };
      setLocalPlaylists((prev) => [...prev, newPlaylist]);
      setShowAddForm(false);
    },
    [setLocalPlaylists, setShowAddForm]
  );

  const handleUpdate = useCallback(
    (oldName: string, updates: { name: string; url: string; twitch_category: string; kick_category: string; priority: number }) => {
      const newName = updates.name;
      setLocalPlaylists((prev) =>
        prev.map((p) => (p.name === oldName ? { ...p, ...updates } : p))
      );
      // Track the rename chain: if oldName was itself a rename, follow it back
      if (newName !== oldName) {
        setRenameMap((prev) => {
          const next = { ...prev };
          const originalName = next[oldName] ?? oldName;
          delete next[oldName];
          // Only store if the new name differs from the original server name
          if (newName !== originalName) {
            next[newName] = originalName;
          }
          return next;
        });
      }
      setEditingName(null);
    },
    [setLocalPlaylists, setRenameMap, setEditingName]
  );

  const handleRemove = useCallback(
    (name: string) => {
      setLocalPlaylists((prev) => prev.filter((p) => p.name !== name));
      // Clean up rename tracking if this playlist was renamed
      setRenameMap((prev) => {
        if (name in prev) {
          const next = { ...prev };
          delete next[name];
          return next;
        }
        return prev;
      });
    },
    [setLocalPlaylists, setRenameMap]
  );

  const handleToggle = useCallback(
    (name: string, currentEnabled: boolean) => {
      setLocalPlaylists((prev) =>
        prev.map((p) =>
          p.name === name ? { ...p, enabled: !currentEnabled } : p
        )
      );
    },
    [setLocalPlaylists]
  );

  const handleDiscard = useCallback(() => {
    setLocalPlaylists(serverPlaylists);
    setEditingName(null);
    setShowAddForm(false);
    setRenameMap({});
  }, [serverPlaylists, setLocalPlaylists, setEditingName, setShowAddForm, setRenameMap]);

  // ── Save: diff local vs server and send commands ──
  const handleSave = useCallback(() => {
    setSaving(true);
    const silent = { silent: true };
    const serverMap = new Map(serverPlaylists.map((p) => [p.name, p]));
    // Build a set of server names that were renamed to something else
    const renamedFromServer = new Set(Object.values(renameMap));
    const localMap = new Map(localPlaylists.map((p) => [p.name, p]));

    // 1) Send renames first (so subsequent update_playlist uses the new name)
    for (const [currentName, originalName] of Object.entries(renameMap)) {
      if (serverMap.has(originalName)) {
        sendCommand("rename_playlist", { old_name: originalName, new_name: currentName }, silent);
      }
    }

    // 2) Removed playlists — skip names that were just renamed
    for (const sp of serverPlaylists) {
      if (!localMap.has(sp.name) && !renamedFromServer.has(sp.name)) {
        sendCommand("remove_playlist", { name: sp.name }, silent);
      }
    }

    // 3) Added playlists — truly new (not in server and not a rename)
    for (const lp of localPlaylists) {
      const isRenamed = renameMap[lp.name]; // was renamed from server name
      if (!serverMap.has(lp.name) && !isRenamed) {
        sendCommand("add_playlist", {
          name: lp.name,
          url: lp.url,
          twitch_category: lp.twitch_category,
          kick_category: lp.kick_category,
          priority: lp.priority,
        }, silent);
        if (!lp.enabled) {
          sendCommand("toggle_playlist", { name: lp.name, enabled: false }, silent);
        }
        continue;
      }
    }

    // 4) Modified playlists (compare against server data using original name)
    for (const lp of localPlaylists) {
      const originalName = renameMap[lp.name] ?? lp.name;
      const sp = serverMap.get(originalName);
      if (!sp) continue; // new — handled above

      // Check enabled toggle
      if (lp.enabled !== sp.enabled) {
        sendCommand("toggle_playlist", { name: lp.name, enabled: lp.enabled }, silent);
      }

      // Check field updates (compare against server values)
      if (
        lp.url !== sp.url ||
        lp.twitch_category !== sp.twitch_category ||
        lp.kick_category !== sp.kick_category ||
        lp.priority !== sp.priority
      ) {
        sendCommand("update_playlist", {
          name: lp.name,
          url: lp.url,
          twitch_category: lp.twitch_category,
          kick_category: lp.kick_category,
          priority: lp.priority,
        }, silent);
      }
    }

    setRenameMap({});
    setPendingSync(true);
    toast.success("Playlist changes saved");
    setSaving(false);
  }, [localPlaylists, serverPlaylists, sendCommand, renameMap, setRenameMap, setPendingSync]);

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
            Manage content playlists on the OSR instance
          </p>
        </div>
        <div className="flex items-center gap-2">
          {state && state.status !== "offline" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="text-green-500 border-green-500/30 cursor-help"
                >
                  Live
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Real-time connection to OSR instance is active</TooltipContent>
            </Tooltip>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            disabled={!connected || !canManageContent}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Playlist
          </Button>
          <CommandButton
            label="Trigger Rotation"
            icon={RefreshCw}
            onClick={() => sendCommand("trigger_rotation")}
            disabled={!instance || !connected || !canTriggerRotation || !canControl}
          />
        </div>
      </div>

      {/* Title Truncation Warning */}
      {titleWarning && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-amber-600 dark:text-amber-400 cursor-help">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="text-sm">
                Worst-case stream title is {titleWarning.length}/{MAX_TITLE_LENGTH} chars — some playlist names may be truncated
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-lg">
            <p className="text-xs font-mono break-all">{titleWarning.preview}</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Not enough playlists warning (persistent, even without unsaved changes) */}
      {notEnoughPlaylists && !hasChanges && (
        <Card className="border-red-500/50 bg-red-500/5">
          <CardContent className="py-3">
            <p className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              You need at least {minEnabledRequired} enabled playlists ({minPerRotation} for the current rotation + {minPerRotation} for the next).
              Currently enabled: {enabledCount}.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Unsaved Changes Bar */}
      {hasChanges && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="py-3 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                You have unsaved changes
              </p>
              {notEnoughPlaylists && (
                <p className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  You need at least {minEnabledRequired} enabled playlists ({minPerRotation} for the current rotation + {minPerRotation} for the next).
                  Currently enabled: {enabledCount}.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (window.confirm("Discard all unsaved playlist changes?")) {
                    handleDiscard();
                  }
                }}
              >
                <Undo2 className="h-4 w-4 mr-1" />
                Discard
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || notEnoughPlaylists}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Add Form */}
      {showAddForm && (
        <AddPlaylistForm
          allNames={localPlaylists.map((p) => p.name)}
          onSubmit={handleAdd}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Playlist Grid */}
      {localPlaylists.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-start">
          {localPlaylists.map((playlist) => {
            const isActive = currentPlaylist
              ?.split(", ")
              .includes(playlist.name);
            if (editingName === playlist.name) {
              return (
                <EditPlaylistForm
                  key={playlist.name}
                  playlist={playlist}
                  allNames={localPlaylists.filter((p) => p.name !== playlist.name).map((p) => p.name)}
                  onSave={(updates) => handleUpdate(playlist.name, updates)}
                  onCancel={() => setEditingName(null)}
                />
              );
            }
            return (
              <PlaylistCard
                key={playlist.name}
                playlist={playlist}
                isActive={!!isActive}
                connected={connected}
                canControl={canControl}
                canManageContent={canManageContent}
                onToggle={() => handleToggle(playlist.name, playlist.enabled)}
                onEdit={() => setEditingName(playlist.name)}
                onDelete={() => handleRemove(playlist.name)}
              />
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {connected
              ? "No playlists configured — add one above!"
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
