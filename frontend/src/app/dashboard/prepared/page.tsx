"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useTeam, useMyRole } from "@/lib/team-context";
import {
  useInstanceWs,
  type PreparedRotation,
} from "@/lib/instance-ws-context";
import {
  Loader2,
  Plus,
  Download,
  Play,
  Trash2,
  CalendarIcon,
  X,
  Check,
  FolderClock,
  Ban,
  Clock,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

// ── Status badge ─────────────────────────────

const statusColors: Record<
  PreparedRotation["status"],
  { variant: "default" | "secondary" | "destructive" | "outline"; label: string }
> = {
  created: { variant: "outline", label: "Created" },
  downloading: { variant: "secondary", label: "Downloading" },
  ready: { variant: "default", label: "Ready" },
  scheduled: { variant: "secondary", label: "Scheduled" },
  executing: { variant: "default", label: "Executing" },
  completed: { variant: "outline", label: "Completed" },
};

function StatusBadge({ status }: { status: PreparedRotation["status"] }) {
  const info = statusColors[status] ?? statusColors.created;
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

// ── Command button with feedback ─────────────

function ActionButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  variant = "outline",
  size = "sm",
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "outline" | "destructive" | "ghost";
  size?: "sm" | "default" | "icon";
}) {
  const [sent, setSent] = useState(false);
  const handleClick = useCallback(() => {
    onClick();
    setSent(true);
    setTimeout(() => setSent(false), 1500);
  }, [onClick]);

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={disabled || sent}
    >
      {sent ? (
        <>
          <Check className="h-4 w-4 mr-1 text-green-500" />
          Sent!
        </>
      ) : (
        <>
          <Icon className="h-4 w-4 mr-1" />
          {label}
        </>
      )}
    </Button>
  );
}

// ── Schedule picker (Calendar + Time) ────────

function SchedulePicker({
  onSchedule,
  onCancel,
}: {
  onSchedule: (isoDate: string) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [hours, setHours] = useState("12");
  const [minutes, setMinutes] = useState("00");

  const scheduled = useMemo(() => {
    if (!date) return null;
    const d = new Date(date);
    d.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
    return d;
  }, [date, hours, minutes]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  const isInPast = scheduled ? scheduled.getTime() < now : false;

  return (
    <div className="space-y-3">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-start gap-2">
            <CalendarIcon className="h-4 w-4" />
            {date ? format(date, "PPP") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            disabled={(day) => day < new Date(new Date().setHours(0, 0, 0, 0))}
          />
        </PopoverContent>
      </Popover>

      <div className="flex items-center gap-2">
        <Select value={hours} onValueChange={setHours}>
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 24 }, (_, i) => (
              <SelectItem key={i} value={String(i).padStart(2, "0")}>
                {String(i).padStart(2, "0")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground">:</span>
        <Select value={minutes} onValueChange={setMinutes}>
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["00", "15", "30", "45"].map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {scheduled && (
        <p className="text-xs text-muted-foreground">
          {isInPast
            ? "⚠ This time is in the past"
            : `In ${formatDistanceToNow(scheduled)}`}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!scheduled || isInPast}
          onClick={() => scheduled && onSchedule(scheduled.toISOString())}
        >
          Confirm Schedule
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── Prepared rotation card ───────────────────

function PreparedRotationCard({
  rotation,
  anyDownloading,
  connected,
  canManageContent,
  sendCommand,
}: {
  rotation: PreparedRotation;
  anyDownloading: boolean;
  connected: boolean;
  canManageContent: boolean;
  sendCommand: (action: string, payload?: Record<string, unknown>) => void;
}) {
  const [showScheduler, setShowScheduler] = useState(false);

  const actions = (() => {
    const s = rotation.status;
    const btns: React.ReactNode[] = [];

    if (s === "created") {
      btns.push(
        <ActionButton
          key="download"
          label="Download"
          icon={Download}
          onClick={() =>
            sendCommand("download_prepared_rotation", {
              slug: rotation.slug,
            })
          }
          disabled={!connected || anyDownloading || !canManageContent}
        />
      );
    }

    if (s === "downloading") {
      btns.push(
        <ActionButton
          key="cancel-dl"
          label="Cancel Download"
          icon={Ban}
          onClick={() =>
            sendCommand("cancel_prepared_download", {
              slug: rotation.slug,
            })
          }
          disabled={!connected || !canManageContent}
        />
      );
    }

    if (s === "ready" || s === "completed") {
      btns.push(
        <ActionButton
          key="execute"
          label="Execute Now"
          icon={Play}
          variant="default"
          onClick={() =>
            sendCommand("execute_prepared_rotation", {
              slug: rotation.slug,
            })
          }
          disabled={!connected || !canManageContent}
        />
      );
      btns.push(
        <Button
          key="schedule"
          variant="outline"
          size="sm"
          onClick={() => setShowScheduler(!showScheduler)}
        >
          <Clock className="h-4 w-4 mr-1" />
          Schedule
        </Button>
      );
    }

    if (s === "scheduled") {
      btns.push(
        <ActionButton
          key="execute-now"
          label="Execute Now"
          icon={Play}
          variant="default"
          onClick={() =>
            sendCommand("execute_prepared_rotation", {
              slug: rotation.slug,
            })
          }
          disabled={!connected || !canManageContent}
        />
      );
      btns.push(
        <ActionButton
          key="cancel-sched"
          label="Cancel Schedule"
          icon={X}
          onClick={() =>
            sendCommand("cancel_prepared_schedule", {
              slug: rotation.slug,
            })
          }
          disabled={!connected || !canManageContent}
        />
      );
    }

    if (s !== "executing") {
      btns.push(
        <ActionButton
          key="delete"
          label="Delete"
          icon={Trash2}
          variant="destructive"
          onClick={() =>
            sendCommand("delete_prepared_rotation", {
              slug: rotation.slug,
            })
          }
          disabled={!connected || !canManageContent}
        />
      );
    }

    return btns;
  })();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderClock className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">{rotation.title}</CardTitle>
            <StatusBadge status={rotation.status} />
          </div>
          <span className="text-xs text-muted-foreground">
            {rotation.video_count} video{rotation.video_count !== 1 ? "s" : ""}
          </span>
        </div>
        <CardDescription className="text-xs">
          Playlists: {rotation.playlists.join(", ") || "—"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rotation.scheduled_at && rotation.status === "scheduled" && (
          <p className="text-xs text-muted-foreground">
            Scheduled for{" "}
            {format(new Date(rotation.scheduled_at), "PPP 'at' h:mm a")} (
            {formatDistanceToNow(new Date(rotation.scheduled_at), {
              addSuffix: true,
            })}
            )
          </p>
        )}

        {rotation.status === "downloading" && (
          <div className="flex items-center gap-2 text-sm text-blue-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Downloading videos...
          </div>
        )}

        {rotation.status === "executing" && (
          <div className="flex items-center gap-2 text-sm text-green-500">
            <Play className="h-4 w-4" />
            Currently playing — trigger rotation to end
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">{actions}</div>

        {showScheduler && (rotation.status === "ready" || rotation.status === "completed") && (
          <SchedulePicker
            onSchedule={(iso) => {
              sendCommand("schedule_prepared_rotation", {
                slug: rotation.slug,
                scheduled_at: iso,
              });
              setShowScheduler(false);
            }}
            onCancel={() => setShowScheduler(false)}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ── Main page ────────────────────────────────

export default function PreparedRotationsPage() {
  const { loading: teamLoading } = useTeam();
  const { canManageContent } = useMyRole();
  const { state, sendCommand, connected } = useInstanceWs();

  const preparedRotations = state?.prepared_rotations ?? [];
  const anyDownloading = state?.any_downloading ?? false;

  // Create form state
  const [title, setTitle] = useState("");
  const [selectedPlaylists, setSelectedPlaylists] = useState<string[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const enabledPlaylists = useMemo(
    () => (state?.playlists ?? []).filter((p) => p.enabled),
    [state?.playlists]
  );

  const togglePlaylist = useCallback((name: string) => {
    setSelectedPlaylists((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }, []);

  const canCreate =
    title.trim().length > 0 && selectedPlaylists.length >= 1;

  const handleCreate = useCallback(() => {
    if (!canCreate) return;
    sendCommand("create_prepared_rotation", {
      title: title.trim(),
      playlists: selectedPlaylists,
    });
    setTitle("");
    setSelectedPlaylists([]);
    setShowCreateForm(false);
    toast.success("Prepared rotation created");
  }, [canCreate, title, selectedPlaylists, sendCommand]);

  const hasCompleted = preparedRotations.some((r) => r.status === "completed");

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
          <h2 className="text-2xl font-bold tracking-tight">
            Prepared Rotations
          </h2>
          <p className="text-muted-foreground">
            Pre-build rotations and execute them on demand or on a schedule
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connected && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-green-500 border-green-500/30 cursor-help">
                  Live
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Real-time connection to OSR instance is active</TooltipContent>
            </Tooltip>
          )}
          {hasCompleted && (
            <ActionButton
              label="Clear Completed"
              icon={Trash2}
              variant="outline"
              onClick={() => sendCommand("clear_completed_prepared")}
              disabled={!connected || !canManageContent}
            />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateForm(!showCreateForm)}
            disabled={!connected || !canManageContent}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Prepared Rotation
          </Button>
        </div>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Create Prepared Rotation
            </CardTitle>
            <CardDescription>
              Select one or more playlists and give it a name. Videos are not
              downloaded until you press Download.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Title</label>
              <Input
                placeholder="e.g., WoW Raid, Chill Stream"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Playlists ({selectedPlaylists.length} selected)
              </label>
              <div className="flex flex-wrap gap-2">
                {enabledPlaylists.map((p) => {
                  const selected = selectedPlaylists.includes(p.name);
                  return (
                    <Button
                      key={p.name}
                      variant={selected ? "default" : "outline"}
                      size="sm"
                      onClick={() => togglePlaylist(p.name)}
                    >
                      {p.name}
                    </Button>
                  );
                })}
                {enabledPlaylists.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No enabled playlists available
                  </p>
                )}
              </div>
              {selectedPlaylists.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Select at least 1 playlist
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button size="sm" disabled={!canCreate} onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-1" />
                Create
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowCreateForm(false);
                  setTitle("");
                  setSelectedPlaylists([]);
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prepared Rotations List */}
      {preparedRotations.length > 0 ? (
        <div className="space-y-4">
          {preparedRotations.map((rotation) => (
            <PreparedRotationCard
              key={rotation.slug}
              rotation={rotation}
              anyDownloading={anyDownloading}
              connected={connected}
              canManageContent={canManageContent}
              sendCommand={sendCommand}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderClock className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {connected
                ? 'No prepared rotations yet. Click "New Prepared Rotation" to get started.'
                : "Waiting for OSR instance connection..."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
