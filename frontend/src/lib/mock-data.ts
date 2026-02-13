// Mock data for development — will be replaced by API calls

export interface StreamStatus {
  isOnline: boolean;
  currentVideo: string;
  currentPlaylist: string;
  currentCategory: string;
  uptime: string;
  viewerCount: number;
  obsConnected: boolean;
  twitchConnected: boolean;
  kickConnected: boolean;
  streamerLive: boolean;
  isPaused: boolean;
  nextRotationEta: string;
  tempPlaybackActive: boolean;
}

export interface Playlist {
  id: number;
  name: string;
  url: string;
  category: string;
  enabled: boolean;
  priority: number;
  videoCount: number;
  lastPlayed: string | null;
}

export interface VideoItem {
  id: number;
  filename: string;
  playlist: string;
  duration: string;
  status: "playing" | "queued" | "played";
}

export interface LogEntry {
  id: number;
  timestamp: string;
  level: "info" | "warning" | "error" | "debug";
  message: string;
}

export interface TeamMember {
  id: string;
  discordUsername: string;
  discordAvatar: string;
  role: "owner" | "content_manager" | "moderator" | "viewer";
  joinedAt: string;
}

export const mockStreamStatus: StreamStatus = {
  isOnline: true,
  currentVideo: "Asmongold Reacts to New FFXIV Expansion Trailer",
  currentPlaylist: "FFXIV Reactions",
  currentCategory: "Final Fantasy XIV Online",
  uptime: "3d 14h 22m",
  viewerCount: 847,
  obsConnected: true,
  twitchConnected: true,
  kickConnected: true,
  streamerLive: false,
  isPaused: false,
  nextRotationEta: "2h 15m",
  tempPlaybackActive: false,
};

export const mockPlaylists: Playlist[] = [
  {
    id: 1,
    name: "FFXIV Reactions",
    url: "https://www.youtube.com/playlist?list=PLexample1",
    category: "Final Fantasy XIV Online",
    enabled: true,
    priority: 1,
    videoCount: 24,
    lastPlayed: "2026-02-12T08:30:00Z",
  },
  {
    id: 2,
    name: "WoW Classic Moments",
    url: "https://www.youtube.com/playlist?list=PLexample2",
    category: "World of Warcraft",
    enabled: true,
    priority: 2,
    videoCount: 18,
    lastPlayed: "2026-02-11T14:00:00Z",
  },
  {
    id: 3,
    name: "Just Chatting Highlights",
    url: "https://www.youtube.com/playlist?list=PLexample3",
    category: "Just Chatting",
    enabled: true,
    priority: 3,
    videoCount: 31,
    lastPlayed: "2026-02-10T20:00:00Z",
  },
  {
    id: 4,
    name: "Dark Souls Playthroughs",
    url: "https://www.youtube.com/playlist?list=PLexample4",
    category: "Dark Souls",
    enabled: false,
    priority: 4,
    videoCount: 12,
    lastPlayed: "2026-02-05T10:00:00Z",
  },
  {
    id: 5,
    name: "Elden Ring DLC",
    url: "https://www.youtube.com/playlist?list=PLexample5",
    category: "Elden Ring",
    enabled: true,
    priority: 1,
    videoCount: 8,
    lastPlayed: null,
  },
];

export const mockCurrentQueue: VideoItem[] = [
  {
    id: 1,
    filename: "01_Asmongold Reacts to New FFXIV Expansion Trailer.mp4",
    playlist: "FFXIV Reactions",
    duration: "42:18",
    status: "playing",
  },
  {
    id: 2,
    filename: "02_FFXIV Dawntrail First Impressions.mp4",
    playlist: "FFXIV Reactions",
    duration: "1:15:33",
    status: "queued",
  },
  {
    id: 3,
    filename: "03_Is FFXIV Better Than WoW Now.mp4",
    playlist: "FFXIV Reactions",
    duration: "55:07",
    status: "queued",
  },
  {
    id: 4,
    filename: "04_WoW Classic Launch Day Madness.mp4",
    playlist: "WoW Classic Moments",
    duration: "38:45",
    status: "queued",
  },
  {
    id: 5,
    filename: "05_The State of Classic WoW.mp4",
    playlist: "WoW Classic Moments",
    duration: "1:02:11",
    status: "queued",
  },
];

export const mockLogs: LogEntry[] = [
  {
    id: 1,
    timestamp: "2026-02-13T04:22:15Z",
    level: "info",
    message: "Video transition: now playing 01_Asmongold Reacts to New FFXIV Expansion Trailer.mp4",
  },
  {
    id: 2,
    timestamp: "2026-02-13T04:22:14Z",
    level: "info",
    message: "Deleted played video: 05_Why Classic WoW Is Peak Gaming.mp4",
  },
  {
    id: 3,
    timestamp: "2026-02-13T03:45:00Z",
    level: "info",
    message: "Category updated to: Final Fantasy XIV Online",
  },
  {
    id: 4,
    timestamp: "2026-02-13T03:44:58Z",
    level: "info",
    message: "Content switch complete — now playing: FFXIV Reactions, WoW Classic Moments",
  },
  {
    id: 5,
    timestamp: "2026-02-13T03:44:55Z",
    level: "info",
    message: "Rotation triggered — all content consumed",
  },
  {
    id: 6,
    timestamp: "2026-02-13T03:40:12Z",
    level: "warning",
    message: "Download retry 2/5 for video: FFXIV_Housing_Madness.mp4 (HTTP 403)",
  },
  {
    id: 7,
    timestamp: "2026-02-13T02:15:00Z",
    level: "info",
    message: "Checked Twitch zackrawrr live status: False",
  },
  {
    id: 8,
    timestamp: "2026-02-13T01:00:00Z",
    level: "info",
    message: "Twitch app access token refreshed",
  },
  {
    id: 9,
    timestamp: "2026-02-12T23:30:00Z",
    level: "error",
    message: "Failed to update Kick category: 401 Unauthorized — token refresh scheduled",
  },
  {
    id: 10,
    timestamp: "2026-02-12T22:00:00Z",
    level: "info",
    message: "Background downloads started for next rotation: Dark Souls Playthroughs, Just Chatting Highlights",
  },
];

export const mockTeamMembers: TeamMember[] = [
  {
    id: "1",
    discordUsername: "theimperious1",
    discordAvatar: "",
    role: "owner",
    joinedAt: "2026-01-15T00:00:00Z",
  },
  {
    id: "2",
    discordUsername: "ContentMod42",
    discordAvatar: "",
    role: "content_manager",
    joinedAt: "2026-01-20T00:00:00Z",
  },
  {
    id: "3",
    discordUsername: "NightShiftAndy",
    discordAvatar: "",
    role: "moderator",
    joinedAt: "2026-02-01T00:00:00Z",
  },
  {
    id: "4",
    discordUsername: "ViewerDave",
    discordAvatar: "",
    role: "viewer",
    joinedAt: "2026-02-10T00:00:00Z",
  },
];
