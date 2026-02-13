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
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useTeam } from "@/lib/team-context";
import { useInstanceWs } from "@/lib/instance-ws-context";
import type { PlaylistConfig } from "@/lib/instance-ws-context";
import {
  Music,
  ExternalLink,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowUpDown,
  Check,
  Plus,
  Trash2,
  Pencil,
  X,
} from "lucide-react";

// ── Helpers ──────────────────────────────────

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
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: PlaylistFormData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<PlaylistFormData>(emptyForm);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add New Playlist
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
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
              className="text-sm"
            />
          </div>
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
              className="text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
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
              className="text-sm"
            />
          </div>
          <div />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            YouTube Playlist URL
          </label>
          <Input
            placeholder="https://www.youtube.com/playlist?list=..."
            value={form.url}
            onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
            className="text-sm"
          />
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
              disabled={!form.name.trim() || !form.url.trim()}
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
  onSave,
  onCancel,
}: {
  playlist: PlaylistConfig;
  onSave: (updates: { url: string; twitch_category: string; kick_category: string; priority: number }) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    url: playlist.url,
    twitch_category: playlist.twitch_category,
    kick_category: playlist.kick_category,
    priority: playlist.priority,
  });

  return (
    <Card className="border-yellow-500/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Pencil className="h-3.5 w-3.5" />
            Editing: {playlist.name}
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
            URL
          </label>
          <Input
            value={form.url}
            onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
            className="text-sm"
          />
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
              className="text-sm"
            />
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
              className="text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
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
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => onSave(form)}>
            Save
          </Button>
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
  onToggle,
  onEdit,
  onDelete,
}: {
  playlist: PlaylistConfig;
  isActive: boolean;
  connected: boolean;
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
              disabled={!connected}
              title={playlist.enabled ? "Disable playlist" : "Enable playlist"}
              className="hover:opacity-80 disabled:opacity-40"
            >
              {playlist.enabled ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="secondary" className="text-[10px]">
            T: {playlist.twitch_category || "—"}
          </Badge>
          {playlist.kick_category && playlist.kick_category !== playlist.twitch_category && (
            <Badge variant="secondary" className="text-[10px]">
              K: {playlist.kick_category}
            </Badge>
          )}
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
        <Separator />
        <div className="flex items-center gap-1 pt-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={onEdit}
            disabled={!connected}
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
              disabled={!connected}
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

export default function PlaylistsPage() {
  const { activeTeam, loading: teamLoading } = useTeam();
  const instance = activeTeam?.instances?.[0] ?? null;
  const { state, sendCommand, connected } = useInstanceWs();

  const playlists = state?.playlists ?? [];
  const settings = state?.settings;
  const currentPlaylist = state?.current_playlist ?? instance?.current_playlist;
  const canTriggerRotation = state?.can_trigger_rotation ?? true;

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);

  const handleAdd = useCallback(
    (data: PlaylistFormData) => {
      sendCommand("add_playlist", {
        name: data.name,
        url: data.url,
        twitch_category: data.twitch_category,
        kick_category: data.kick_category,
        priority: data.priority,
      });
      setShowAddForm(false);
    },
    [sendCommand]
  );

  const handleUpdate = useCallback(
    (name: string, updates: { url: string; twitch_category: string; kick_category: string; priority: number }) => {
      sendCommand("update_playlist", { name, ...updates });
      setEditingName(null);
    },
    [sendCommand]
  );

  const handleRemove = useCallback(
    (name: string) => {
      sendCommand("remove_playlist", { name });
    },
    [sendCommand]
  );

  const handleToggle = useCallback(
    (name: string, currentEnabled: boolean) => {
      sendCommand("toggle_playlist", { name, enabled: !currentEnabled });
    },
    [sendCommand]
  );

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
          {connected && (
            <Badge
              variant="outline"
              className="text-green-500 border-green-500/20"
            >
              Live
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            disabled={!connected}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Playlist
          </Button>
          <CommandButton
            label="Trigger Rotation"
            icon={RefreshCw}
            onClick={() => sendCommand("trigger_rotation")}
            disabled={!instance || !connected || !canTriggerRotation}
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

      {/* Add Form */}
      {showAddForm && (
        <AddPlaylistForm
          onSubmit={handleAdd}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Playlist Grid */}
      {playlists.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {playlists.map((playlist) => {
            const isActive = currentPlaylist
              ?.split(", ")
              .includes(playlist.name);
            if (editingName === playlist.name) {
              return (
                <EditPlaylistForm
                  key={playlist.name}
                  playlist={playlist}
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
