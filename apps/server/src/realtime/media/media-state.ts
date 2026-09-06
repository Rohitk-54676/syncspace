import type {
    MediaItem,
    MediaPlaybackState,
    MediaType,
    PlaybackMode,
} from "@syncspace/shared";

export interface CreatePlaybackStateOptions {
    mediaType: MediaType;
    mediaId?: string | null;
    position?: number;
    isPlaying?: boolean;
    updatedBy?: string | null;
    currentIndex?: number | null;
    mode?: PlaybackMode;
}

/**
 * Creates the initial authoritative playback state for a room.
 */
export function createInitialPlaybackState(
    mediaType: MediaType,
): MediaPlaybackState {
    return {
        mediaId: null,
        mediaType,
        position: 0,
        isPlaying: false,
        updatedAt: Date.now(),
        updatedBy: null,
        currentIndex: null,
        mode: "normal",
    };
}

/**
 * Creates playback state for a selected media item.
 */
export function createMediaPlaybackState(
    options: CreatePlaybackStateOptions,
): MediaPlaybackState {
    return {
        mediaId:
            options.mediaId ?? null,
        mediaType:
            options.mediaType,
        position:
            options.position ?? 0,
        isPlaying:
            options.isPlaying ?? false,
        updatedAt:
            Date.now(),
        updatedBy:
            options.updatedBy ?? null,
        currentIndex:
            options.currentIndex ?? null,
        mode:
            options.mode ?? "normal",
    };
}

/**
 * Returns playback state for an empty queue.
 */
export function createEmptyPlaybackState(
    mediaType: MediaType,
    mode: PlaybackMode = "normal",
    updatedBy: string | null = null,
): MediaPlaybackState {
    return {
        mediaId: null,
        mediaType,
        position: 0,
        isPlaying: false,
        updatedAt: Date.now(),
        updatedBy,
        currentIndex: null,
        mode,
    };
}

/**
 * Returns playback state for a selected queue item.
 */
export function createSelectedMediaPlaybackState(
    media: MediaItem,
    mediaType: MediaType,
    currentIndex: number,
    options?: {
        isPlaying?: boolean;
        position?: number;
        mode?: PlaybackMode;
        updatedBy?: string | null;
    },
): MediaPlaybackState {
    return {
        mediaId: media.mediaId,
        mediaType,
        position:
            options?.position ?? 0,
        isPlaying:
            options?.isPlaying ?? false,
        updatedAt: Date.now(),
        updatedBy:
            options?.updatedBy ?? null,
        currentIndex,
        mode:
            options?.mode ?? "normal",
    };
}