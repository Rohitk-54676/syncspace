export type RoomType = "music" | "video";

export interface ParticipantIdentity {
  participantId: string;
  displayName: string;
}

export interface Room {
  id: string;
  code: string;
  type: RoomType;
  maxSeats: number;
  createdAt: string;
  expiresAt: string;
}

export interface ActiveParticipant
  extends ParticipantIdentity {
  socketId: string;
  seat: number | null;
  isHost: boolean;
}

export interface ActiveRoom {
  roomId: string;
  code: string;
  type: RoomType;
  maxSeats: number;
  participants: Map<string, ActiveParticipant>;
  queue: MediaItem[];
  playback: MediaPlaybackState;
  shuffleOrder: number[];
  shufflePosition: number;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  participantId: string;
  displayName: string;
  message: string;
  createdAt: number;
}

export type MediaType = "music" | "video";

export interface MediaItem {
  mediaId: string;
  mediaType: MediaType;
  title: string;
  duration: number | null;
  thumbnailUrl: string | null;
}

export type PlaybackMode =
  | "normal"
  | "repeat_one"
  | "repeat_queue"
  | "shuffle";

export interface MediaPlaybackState {
  mediaId: string | null;
  mediaType: MediaType;
  position: number;
  isPlaying: boolean;
  updatedAt: number;
  updatedBy: string | null;
  currentIndex: number | null;
  mode: PlaybackMode;
}

/*
 * ============================================================
 * SOCKET.IO EVENTS
 * ============================================================
 */

export interface ClientToServerEvents {
  "room:join": (payload: {
    roomId: string;
    participantId: string;
    displayName: string;
  }) => void;

  "room:seat-change": (payload: {
    participantId: string;
    seat: number;
  }) => void;

  "chat:send": (payload: {
    message: string;
  }) => void;

  "music:queue-add": (payload: {
    media: MediaItem;
  }) => void;

  "music:queue-remove": (payload: {
    index: number;
  }) => void;

  "music:play": () => void;

  "music:pause": () => void;

  "music:seek": (payload: {
    position: number;
  }) => void;

  "music:next": () => void;

  "music:previous": () => void;

  "music:set-mode": (payload: {
    mode: PlaybackMode;
  }) => void;

  "music:ended": () => void;
}

export interface ServerToClientEvents {
  "room:joined": (data: {
    room: {
      id: string;
      code: string;
      type: RoomType;
      maxSeats: number;
    };
    participant: ActiveParticipant;
  }) => void;

  "room:error": (data: {
    message: string;
  }) => void;

  "room:participants": (data: {
    participants: ActiveParticipant[];
  }) => void;

  "room:seat-error": (data: {
    message: string;
  }) => void;

  "chat:message": (
    message: ChatMessage,
  ) => void;

  "chat:error": (data: {
    message: string;
  }) => void;

  "music:queue-updated": (data: {
    queue: MediaItem[];
  }) => void;

  "music:queue-error": (data: {
    message: string;
  }) => void;

  "music:playback-updated": (data: {
    playback: MediaPlaybackState;
  }) => void;

  "music:playback-error": (data: {
    message: string;
  }) => void;
}