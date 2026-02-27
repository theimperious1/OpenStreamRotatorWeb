"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  LayoutDashboard,
  ListMusic,
  PlayCircle,
  FolderClock,
  ScrollText,
  Tv,
  Users,
  Settings,
  ChevronDown,
  HelpCircle,
  Wifi,
  WifiOff,
  Shield,
  Crown,
  Lock,
} from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitBugReport } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Bug, Send } from "lucide-react";

interface FaqItem {
  question: string;
  answer: string;
}

function FaqSection({ question, answer, open, onToggle }: FaqItem & { open: boolean; onToggle: () => void }) {
  return (
    <Collapsible open={open} onOpenChange={onToggle}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors text-left">
        <span>{question}</span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-3 text-sm text-muted-foreground leading-relaxed">
        {answer}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface FeatureItem {
  icon: React.ElementType;
  title: string;
  description: string;
  details: string[];
}

function FeatureCard({ icon: Icon, title, description, details, open, onToggle }: FeatureItem & { open: boolean; onToggle: () => void }) {
  return (
    <Collapsible open={open} onOpenChange={onToggle}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger className="w-full text-left">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">{title}</CardTitle>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  open ? "rotate-180" : ""
                }`}
              />
            </div>
            <CardDescription className="mt-1">{description}</CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {details.map((detail, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

const features: FeatureItem[] = [
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    description:
      "Real-time overview of your stream status, connections, and recent activity.",
    details: [
      "The status banner shows whether your stream is online, paused, or offline with a live indicator dot.",
      "Pause/Resume button lets you manually pause the stream (admins and content managers only).",
      "Now Playing shows the currently playing video and its playlist name.",
      "Category displays the active Twitch/Kick stream category, which updates automatically per video.",
      "Uptime tracks how long OSR has been running since its last restart.",
      "Connections shows OBS WebSocket and Web Dashboard connectivity status.",
      "Recent Activity shows the latest log entries streamed from OSR in real-time.",
      "When fallback mode is active, the dashboard shows a Fallback Mode indicator and the currently playing fallback content instead of normal rotation info.",
    ],
  },
  {
    icon: ListMusic,
    title: "Playlists",
    description:
      "Manage your video playlists — add YouTube/Twitch URLs, set categories, and control playback order.",
    details: [
      "Each playlist has a name, URL (YouTube playlist or Twitch VOD collection), and platform categories.",
      "T: and K: badges show the Twitch and Kick categories that will be set when this playlist plays.",
      "The green checkmark means the playlist is enabled; grey X means disabled. Click to toggle.",
      "Priority determines which playlists are preferred during rotation — higher priority = more likely to play.",
      "Use Add Playlist to create new playlists, and Edit to modify existing ones.",
      "Reload Playlists re-fetches the playlist config from the OSR instance.",
      "Download All triggers downloading all playlist videos (useful after adding new playlists).",
    ],
  },
  {
    icon: PlayCircle,
    title: "Queue",
    description:
      "View the current rotation playback order and control video playback.",
    details: [
      "The queue shows all video files in the rotation folder in their playback order.",
      "A play icon (▶) marks the currently playing video; file icons show queued videos.",
      "Skip Current advances to the next video in the rotation.",
      "The Live badge means the dashboard is connected to OSR via WebSocket.",
      "Downloading badge appears when a video is being downloaded in the background.",
      "OSR Unreachable means the last command couldn't be delivered (check your instance).",
    ],
  },
  {
    icon: FolderClock,
    title: "Prepared Rotations",
    description:
      "Schedule playlist rotations in advance — pick playlists and activate them on demand or on a schedule.",
    details: [
      "A prepared rotation is a named set of playlists that can be activated together.",
      "Create a rotation, select which playlists to include, then execute it when ready.",
      "Executing a rotation downloads the selected playlists' videos and swaps them into the live rotation.",
      "Status badges: Created → Downloading → Ready → Executing → Completed.",
      "Use this to pre-plan content blocks (e.g., \"Morning Music\" → \"Afternoon Gaming\").",
      "Scheduled rotations activate automatically at the configured date/time.",
      "Prepared rotations can be marked as fallback rotations — if all normal downloads fail, OSR cycles through the ones you've designated as fallback to keep the stream running.",
    ],
  },
  {
    icon: ScrollText,
    title: "Logs",
    description:
      "View all log entries from the connected OSR instance in real-time.",
    details: [
      "Logs stream in via WebSocket and are color-coded by level: error (red), warning (yellow), info, debug.",
      "Use the search box to filter logs by keyword.",
      "Level filter buttons let you show/hide specific log levels.",
      "Logs are only available while the dashboard WebSocket is connected to OSR.",
    ],
  },
  {
    icon: Tv,
    title: "Stream Preview",
    description:
      "Watch a live preview of your stream directly in the dashboard (requires HLS setup).",
    details: [
      "Preview requires an RTMP→HLS relay (e.g., MediaMTX) configured to receive your OBS output.",
      "Set the HLS URL on the Team page under your instance settings.",
      "The viewer count shows how many team members are currently watching the preview.",
      "Preview plays with HLS.js — low latency but typically 5-15 seconds behind live.",
    ],
  },
  {
    icon: Users,
    title: "Team",
    description:
      "Manage your team members, roles, instances, and invite links.",
    details: [
      "The team creator has full control and is the only one who can promote/demote admins.",
      "Admin role: Full control over all settings, credentials, team management, and instances.",
      "Content Manager: Can manage playlists, trigger rotations, adjust stream settings.",
      "Moderator: Can view status, skip videos, and pause/resume the stream.",
      "Viewer: Read-only access to the dashboard and stream status.",
      "Invite Links let you generate shareable URLs with a preset role, optional expiry, and use limits.",
      "Instances represent connected OSR programs. Create one to get an API key for your .env file.",
    ],
  },
  {
    icon: Settings,
    title: "Settings",
    description:
      "Configure OBS, Twitch, Kick, Discord, and stream behavior settings remotely.",
    details: [
      "Stream settings (rotation interval, shuffle, etc.) can be edited by content managers and above.",
      "Credential sections (OBS, Twitch, Kick, Discord) are restricted to admins only.",
      "Changes are batched — edit multiple fields, then click Save to apply them all at once.",
      "The Connected/Disconnected badge on each section shows whether that service is configured.",
      "Password fields can be toggled visible with the eye icon.",
    ],
  },
];

const faqs: FaqItem[] = [
  {
    question: "What is OpenStreamRotator?",
    answer:
      "OpenStreamRotator (OSR) is a 24/7 stream automation system. It automatically rotates video playlists on your Twitch/Kick stream via OBS, manages categories, detects when a target streamer goes live (to pause the 24/7 stream), and provides a web dashboard for remote management.",
  },
  {
    question: "How do I connect OSR to the dashboard?",
    answer:
      'Go to the Team page, create an instance, and copy the API key. In your OSR .env file, set WEB_DASHBOARD_URL to your backend WebSocket URL (e.g., ws://localhost:8000) and WEB_DASHBOARD_API_KEY to the key you copied. Restart OSR and it will connect automatically.',
  },
  {
    question: "Why does the dashboard say \"Stream Offline\"?",
    answer:
      "This means the OSR instance is not connected to the dashboard WebSocket. Check that your WEB_DASHBOARD_URL and WEB_DASHBOARD_API_KEY are correct in the .env file, and that the backend server is running.",
  },
  {
    question: "What do the status colors mean?",
    answer:
      "Green = online/connected/enabled. Yellow = paused (either manually or because the target streamer is live). Red = offline/disconnected/error. Blue = an action is in progress (like downloading).",
  },
  {
    question: "How does live detection work?",
    answer:
      "If you set TARGET_TWITCH_STREAMER or TARGET_KICK_STREAMER in your .env, OSR polls those channels. When the target goes live, OSR automatically switches to the pause scene in OBS. When they go offline, OSR resumes the 24/7 rotation.",
  },
  {
    question: "Can multiple people manage the same stream?",
    answer:
      "Yes! Create a team on the Team page and invite members with different roles. Admins get full control, Content Managers can manage playlists and rotations, Moderators can skip videos, and Viewers can only watch the dashboard.",
  },
  {
    question: "What is a Prepared Rotation?",
    answer:
      "A prepared rotation is a pre-configured set of playlists that you can activate on demand. Think of it like a scheduling block — e.g., \"Morning Music\" or \"Weekend Gaming\". When you execute a prepared rotation, OSR downloads the videos and swaps them into the live rotation folder.",
  },
  {
    question: "How do I set up Stream Preview?",
    answer:
      "You need an RTMP-to-HLS relay like MediaMTX. Configure OBS to send a secondary output to the relay, then set the HLS URL on the Team page under your instance. The preview will then be available in the Preview tab.",
  },
  {
    question: "What OBS scenes do I need?",
    answer:
      'OSR expects three scenes: a stream scene (with a VLC media source for video playback), a pause screen (shown when the target streamer is live), and a rotation screen (shown briefly during video transitions). Name them in your .env as SCENE_STREAM, SCENE_PAUSE, and SCENE_ROTATION_SCREEN.',
  },
  {
    question: "Why can't I edit certain settings?",
    answer:
      'Credential settings (OBS, Twitch, Kick, Discord) are restricted to users with the Admin role. If you see a "Admin only" badge, ask a team admin to make changes or have them promote your role.',
  },
  {
    question: "How do I report a bug?",
    answer:
      "Check the Logs page for error messages that might explain the issue. If you need to report a bug, note the error message, what you were doing when it happened, and your OSR version. You can file an issue on the project's GitHub repository.",
  },
  {
    question: "What is Fallback Mode?",
    answer:
      "Fallback mode activates automatically when OSR cannot download any new content after repeated failures. It cycles through prepared rotations you've explicitly marked as fallback to keep the stream running with previously downloaded videos. If no fallback rotations are configured, OSR displays the pause screen instead. Once fresh content downloads successfully, fallback mode deactivates and normal rotation resumes. Fallback plays do not affect playlist play counts or selection stats.",
  },
  {
    question: "What happens if all my prepared rotations are exhausted during fallback?",
    answer:
      "OSR cycles back to the first fallback rotation and keeps looping through them. If you haven't marked any prepared rotations as fallback, it falls back to the pause screen. In either case, OSR keeps retrying downloads in the background and will automatically return to normal operation once content is available again.",
  },
];

export default function HelpPage() {
  const [openFeature, setOpenFeature] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <HelpCircle className="h-6 w-6" />
          Help & FAQ
        </h2>
        <p className="text-muted-foreground mt-1">
          Learn how to use the OpenStreamRotator dashboard
        </p>
      </div>

      {/* Feature Guide */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Dashboard Features</h3>
        <p className="text-sm text-muted-foreground">
          Click any section to expand and learn more about each feature.
        </p>
        <div className="grid md:grid-cols-2 gap-3 items-start">
          <div className="space-y-3">
            {features.filter((_, i) => i % 2 === 0).map((feature) => (
              <FeatureCard
                key={feature.title}
                {...feature}
                open={openFeature === feature.title}
                onToggle={() => setOpenFeature(prev => prev === feature.title ? null : feature.title)}
              />
            ))}
          </div>
          <div className="space-y-3">
            {features.filter((_, i) => i % 2 === 1).map((feature) => (
              <FeatureCard
                key={feature.title}
                {...feature}
                open={openFeature === feature.title}
                onToggle={() => setOpenFeature(prev => prev === feature.title ? null : feature.title)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Role Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role Permissions
          </CardTitle>
          <CardDescription>
            What each team role can do
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium">Feature</th>
                  <th className="text-center py-2 px-2 font-medium">
                    <div className="flex items-center justify-center gap-1">
                      <Crown className="h-3.5 w-3.5 text-yellow-500" />
                      Admin
                    </div>
                  </th>
                  <th className="text-center py-2 px-2 font-medium">Content Mgr</th>
                  <th className="text-center py-2 px-2 font-medium">Moderator</th>
                  <th className="text-center py-2 px-2 font-medium">Viewer</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                {[
                  ["View dashboard & status", true, true, true, true],
                  ["View logs & queue", true, true, true, true],
                  ["Watch stream preview", true, true, true, true],
                  ["Skip current video", true, true, true, false],
                  ["Toggle ignore streamer", true, true, false, false],
                  ["Manage playlists", true, true, false, false],
                  ["Trigger rotations", true, true, false, false],
                  ["Pause/resume stream", true, true, false, false],
                  ["Edit stream settings", true, true, false, false],
                  ["Download videos", true, true, false, false],
                  ["Edit credentials (OBS, etc.)", true, false, false, false],
                  ["Manage team members", true, false, false, false],
                  ["Create/delete instances", true, false, false, false],
                  ["Manage invite links", true, true, false, false],
                ].map(([label, admin, cm, mod, viewer], i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-4">{label as string}</td>
                    <td className="text-center py-2 px-2">
                      {admin ? "✓" : "—"}
                    </td>
                    <td className="text-center py-2 px-2">
                      {cm ? "✓" : "—"}
                    </td>
                    <td className="text-center py-2 px-2">
                      {mod ? "✓" : "—"}
                    </td>
                    <td className="text-center py-2 px-2">
                      {viewer ? "✓" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Status Colors Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status Colors & Icons</CardTitle>
          <CardDescription>Quick reference for status indicators across the dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-flex rounded-full h-3 w-3 bg-green-500" />
              <span className="text-muted-foreground">Online / Connected / Enabled</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-flex rounded-full h-3 w-3 bg-yellow-500" />
              <span className="text-muted-foreground">Paused / Warning</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-flex rounded-full h-3 w-3 bg-red-500" />
              <span className="text-muted-foreground">Offline / Disconnected / Error</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-flex rounded-full h-3 w-3 bg-blue-500" />
              <span className="text-muted-foreground">In Progress (downloading, etc.)</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Wifi className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground">Service connected</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <WifiOff className="h-4 w-4 text-red-500" />
              <span className="text-muted-foreground">Service disconnected</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Admin-only feature</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <PlayCircle className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Currently playing</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FAQ */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Frequently Asked Questions</h3>
        <Card>
          <CardContent className="p-0 divide-y">
            {faqs.map((faq, i) => (
              <FaqSection
                key={i}
                {...faq}
                open={openFaq === i}
                onToggle={() => setOpenFaq(prev => prev === i ? null : i)}
              />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Bug Report */}
      <BugReportForm />
    </div>
  );
}

// ── Bug Report Form ──

function BugReportForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      await submitBugReport({
        title: title.trim(),
        description: description.trim(),
        steps_to_reproduce: steps.trim(),
        severity,
      });
      toast.success("Bug report submitted! Thank you for your feedback.");
      setTitle("");
      setDescription("");
      setSteps("");
      setSeverity("medium");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit bug report");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Bug className="h-5 w-5" />
        Report a Bug
      </h3>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bug Report</CardTitle>
          <CardDescription>
            Found something broken? Fill out the form below and we&apos;ll look into it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
              <div className="space-y-1">
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="Brief summary of the issue"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Severity</label>
                <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="What happened? What did you expect to happen?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Steps to Reproduce{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                placeholder="1. Go to ...&#10;2. Click on ...&#10;3. See error"
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                rows={3}
              />
            </div>
            <Button type="submit" disabled={submitting || !title.trim() || !description.trim()}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit Report
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
