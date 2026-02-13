"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useTeam } from "@/lib/team-context";
import { useAuth } from "@/lib/auth-context";
import {
  createTeam,
  inviteMember,
  updateMemberRole,
  removeMember,
  createInstance,
  deleteInstance,
  createInviteLink,
  listInviteLinks,
  revokeInviteLink,
  type TeamMember,
  type InviteLink,
} from "@/lib/api";
import {
  UserPlus,
  Shield,
  MoreHorizontal,
  Crown,
  Pencil,
  UserX,
  Loader2,
  Plus,
  Server,
  Copy,
  Check,
  Trash2,
  Link,
  Clock,
  Ban,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";

const roleConfig = {
  owner: {
    label: "Owner",
    color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    icon: Crown,
    description: "Full control — credentials, team management, all settings",
  },
  content_manager: {
    label: "Content Manager",
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    icon: Pencil,
    description: "Manage playlists, trigger rotations, adjust stream settings",
  },
  moderator: {
    label: "Moderator",
    color: "bg-green-500/10 text-green-500 border-green-500/20",
    icon: Shield,
    description: "View status, skip videos, toggle debug mode",
  },
  viewer: {
    label: "Viewer",
    color: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    icon: Shield,
    description: "Read-only access to dashboard and stream status",
  },
};

export default function TeamPage() {
  const { activeTeam, loading, refresh } = useTeam();
  const { user } = useAuth();
  const [inviteDiscordId, setInviteDiscordId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [instanceName, setInstanceName] = useState("");
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Invite link state
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);
  const [linkRole, setLinkRole] = useState<TeamMember["role"]>("viewer");
  const [linkExpiry, setLinkExpiry] = useState<string>("never");
  const [linkMaxUses, setLinkMaxUses] = useState<string>("0");
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Clipboard helper — falls back to execCommand for plain HTTP
  function copyToClipboard(text: string): void {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  }

  const members = activeTeam?.members ?? [];
  const myRole = members.find((m) => m.user_id === user?.id)?.role;
  const isOwner = myRole === "owner";
  const canManageInvites = isOwner || myRole === "content_manager";

  // Auto-fetch invite links when team loads
  useEffect(() => {
    if (activeTeam && canManageInvites) {
      fetchInviteLinks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTeam?.id]);

  async function handleCreateTeam() {
    if (!teamName.trim()) return;
    setCreating(true);
    try {
      await createTeam(teamName.trim());
      setTeamName("");
      await refresh();
    } finally {
      setCreating(false);
    }
  }

  async function handleInvite() {
    if (!inviteDiscordId.trim() || !activeTeam) return;
    setInviting(true);
    try {
      await inviteMember(activeTeam.id, inviteDiscordId.trim());
      setInviteDiscordId("");
      await refresh();
    } finally {
      setInviting(false);
    }
  }

  async function fetchInviteLinks() {
    if (!activeTeam) return;
    setLoadingInvites(true);
    try {
      const links = await listInviteLinks(activeTeam.id);
      setInviteLinks(links);
    } finally {
      setLoadingInvites(false);
    }
  }

  async function handleCreateLink() {
    if (!activeTeam) return;
    setCreatingLink(true);
    try {
      const expiryHours = linkExpiry === "never" ? null : parseInt(linkExpiry, 10);
      const maxUses = parseInt(linkMaxUses, 10) || 0;
      const link = await createInviteLink(activeTeam.id, linkRole, maxUses, expiryHours);
      setInviteLinks((prev) => [link, ...prev]);
      const url = `${window.location.origin}/invite/${link.code}`;
      copyToClipboard(url);
      toast.success("Invite link created and copied to clipboard!");
    } catch {
      toast.error("Failed to create invite link");
    } finally {
      setCreatingLink(false);
    }
  }

  async function handleRevokeLink(inviteId: string) {
    if (!activeTeam) return;
    try {
      await revokeInviteLink(activeTeam.id, inviteId);
      setInviteLinks((prev) =>
        prev.map((l) => (l.id === inviteId ? { ...l, status: "revoked" as const } : l))
      );
      toast.success("Invite revoked");
    } catch {
      toast.error("Failed to revoke invite");
    }
  }

  function handleCopyLink(code: string) {
    const url = `${window.location.origin}/invite/${code}`;
    copyToClipboard(url);
    setCopiedLink(code);
    toast.success("Invite link copied!");
    setTimeout(() => setCopiedLink(null), 2000);
  }

  async function handleRoleChange(memberId: string, role: TeamMember["role"]) {
    if (!activeTeam) return;
    await updateMemberRole(activeTeam.id, memberId, role);
    await refresh();
  }

  async function handleRemove(memberId: string) {
    if (!activeTeam) return;
    await removeMember(activeTeam.id, memberId);
    await refresh();
  }

  async function handleCreateInstance() {
    if (!activeTeam) return;
    setCreatingInstance(true);
    try {
      await createInstance(activeTeam.id, instanceName.trim() || "Default Instance");
      setInstanceName("");
      await refresh();
    } finally {
      setCreatingInstance(false);
    }
  }

  async function handleDeleteInstance(instanceId: string) {
    if (!activeTeam) return;
    await deleteInstance(activeTeam.id, instanceId);
    await refresh();
  }

  function handleCopyKey(apiKey: string) {
    copyToClipboard(apiKey);
    setCopiedKey(apiKey);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No team yet — show creation form
  if (!activeTeam) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Team</h2>
          <p className="text-muted-foreground">
            Create a team to get started managing your stream.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create Team</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Input
              placeholder="Team name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="max-w-xs"
              onKeyDown={(e) => e.key === "Enter" && handleCreateTeam()}
            />
            <Button onClick={handleCreateTeam} disabled={creating || !teamName.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Create
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Team</h2>
          <p className="text-muted-foreground">
            Manage team members and permissions
          </p>
        </div>
      </div>

      {/* Roles Overview */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {Object.entries(roleConfig).map(([key, config]) => (
          <Card key={key}>
            <CardContent className="py-3">
              <div className="flex items-center gap-2 mb-1">
                <config.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{config.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {config.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />

      {/* OSR Instances */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">OSR Instances</CardTitle>
          <CardDescription>
            Register OSR instances to connect them to this dashboard. Each instance gets a unique API key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeTeam.instances.length > 0 && (
            <div className="space-y-3">
              {activeTeam.instances.map((inst) => (
                <div
                  key={inst.id}
                  className="flex items-center gap-3 rounded-md border px-4 py-3"
                >
                  <Server className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{inst.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono truncate max-w-[280px]">
                        {inst.api_key}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={() => handleCopyKey(inst.api_key)}
                      >
                        {copiedKey === inst.api_key ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${
                          inst.status === "online"
                            ? "bg-green-500/10 text-green-500 border-green-500/20"
                            : inst.status === "paused"
                            ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                            : "bg-gray-500/10 text-gray-500 border-gray-500/20"
                        }`}
                      >
                        {inst.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Created {new Date(inst.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteInstance(inst.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {isOwner && (
            <div className="flex items-center gap-3">
              <Input
                placeholder="Instance name (optional)"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                className="max-w-xs"
                onKeyDown={(e) => e.key === "Enter" && handleCreateInstance()}
              />
              <Button
                onClick={handleCreateInstance}
                disabled={creatingInstance}
                variant="outline"
              >
                {creatingInstance ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Add Instance
              </Button>
            </div>
          )}

          {activeTeam.instances.length === 0 && !isOwner && (
            <p className="text-sm text-muted-foreground">No instances registered yet.</p>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Invite Links */}
      {(isOwner || myRole === "content_manager") && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Invite Links</CardTitle>
                <CardDescription>
                  Create shareable links to invite people to your team
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchInviteLinks}
                disabled={loadingInvites}
              >
                {loadingInvites ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Refresh"
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Create new link */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Role</label>
                <Select value={linkRole} onValueChange={(v) => setLinkRole(v as TeamMember["role"])}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                    <SelectItem value="content_manager">Content Manager</SelectItem>
                    {isOwner && <SelectItem value="owner">Owner</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Expires</label>
                <Select value={linkExpiry} onValueChange={setLinkExpiry}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never</SelectItem>
                    <SelectItem value="1">1 hour</SelectItem>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="168">7 days</SelectItem>
                    <SelectItem value="720">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Max uses</label>
                <Select value={linkMaxUses} onValueChange={setLinkMaxUses}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Unlimited</SelectItem>
                    <SelectItem value="1">1 use</SelectItem>
                    <SelectItem value="5">5 uses</SelectItem>
                    <SelectItem value="10">10 uses</SelectItem>
                    <SelectItem value="25">25 uses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreateLink} disabled={creatingLink}>
                {creatingLink ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Link className="h-4 w-4 mr-2" />
                )}
                Create Link
              </Button>
            </div>

            {/* Existing links */}
            {inviteLinks.length > 0 && (
              <div className="space-y-2">
                {inviteLinks.map((link) => {
                  const isActive = link.status === "pending";
                  const isExpired =
                    link.expires_at && new Date(link.expires_at) < new Date();
                  const isUsedUp =
                    link.max_uses > 0 && link.use_count >= link.max_uses;
                  const effectivelyActive = isActive && !isExpired && !isUsedUp;

                  return (
                    <div
                      key={link.id}
                      className={`flex items-center gap-3 rounded-md border px-4 py-3 ${
                        effectivelyActive ? "" : "opacity-60"
                      }`}
                    >
                      <Link className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                            {link.code}
                          </code>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${
                              roleConfig[link.role]?.color ?? ""
                            }`}
                          >
                            {roleConfig[link.role]?.label ?? link.role}
                          </Badge>
                          {!effectivelyActive && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 bg-red-500/10 text-red-500 border-red-500/20"
                            >
                              {link.status === "revoked"
                                ? "Revoked"
                                : isExpired
                                ? "Expired"
                                : isUsedUp
                                ? "Used up"
                                : link.status}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>
                            {link.use_count}
                            {link.max_uses > 0 ? `/${link.max_uses}` : ""} uses
                          </span>
                          {link.expires_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(link.expires_at).toLocaleDateString()}
                            </span>
                          )}
                          <span>by {link.created_by}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {effectivelyActive && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleCopyLink(link.code)}
                          >
                            {copiedLink === link.code ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                        {effectivelyActive && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleRevokeLink(link.id)}
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {inviteLinks.length === 0 && !loadingInvites && (
              <p className="text-sm text-muted-foreground">
                No invite links yet. Create one above to share with your team.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members</CardTitle>
          <CardDescription>
            {members.length} team member{members.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Direct add by Discord ID (owner only) */}
          {isOwner && (
            <div className="flex items-center gap-3">
              <Input
                placeholder="Add by Discord ID"
                value={inviteDiscordId}
                onChange={(e) => setInviteDiscordId(e.target.value)}
                className="max-w-xs"
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              />
              <Button
                variant="outline"
                onClick={handleInvite}
                disabled={inviting || !inviteDiscordId.trim()}
              >
                {inviting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Add
              </Button>
            </div>
          )}

          <div className="space-y-3">
            {members.map((member) => {
              const role = roleConfig[member.role];
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="h-9 w-9">
                    {member.discord_avatar && (
                      <AvatarImage src={member.discord_avatar} alt={member.discord_username} />
                    )}
                    <AvatarFallback className="text-xs">
                      {member.discord_username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {member.discord_username}
                      </p>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${role.color}`}
                      >
                        {role.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Joined{" "}
                      {new Date(member.joined_at).toLocaleDateString()}
                    </p>
                  </div>

                  {isOwner && member.role !== "owner" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <Shield className="h-4 w-4 mr-2" />
                            Change Role
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {(["content_manager", "moderator", "viewer"] as const)
                              .filter((r) => r !== member.role)
                              .map((r) => (
                                <DropdownMenuItem
                                  key={r}
                                  onClick={() => handleRoleChange(member.id, r)}
                                >
                                  {roleConfig[r].label}
                                </DropdownMenuItem>
                              ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleRemove(member.id)}
                        >
                          <UserX className="h-4 w-4 mr-2" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
