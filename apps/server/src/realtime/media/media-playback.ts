import type {
    MediaItem,
    MediaPlaybackState,
} from "@syncspace/shared";

/**
 * Returns the authoritative playback position.
 *
 * When playback is paused, the stored position is authoritative.
 * When playback is active, elapsed wall-clock time is added to
 * the stored position.
 */
export function getCurrentPlaybackPosition(
    playback: MediaPlaybackState,
): number {
    if (!playback.isPlaying) {
        return Math.max(
            0,
            playback.position,
        );
    }

    const elapsed =
        (Date.now() -
            playback.updatedAt) /
        1000;

    return Math.max(
        0,
        playback.position +
        Math.max(0, elapsed),
    );
}

/**
 * Clamp a requested playback position to valid bounds.
 *
 * If the current media has a known duration, the position cannot
 * exceed that duration.
 */
export function clampPlaybackPosition(
    position: number,
    media: MediaItem | null,
): number {
    if (
        media?.duration !== null &&
        media?.duration !== undefined
    ) {
        return Math.min(
            Math.max(0, position),
            media.duration,
        );
    }

    return Math.max(
        0,
        position,
    );
}

/**
 * Creates a normalized playback state update.
 *
 * This does not mutate the supplied playback state.
 */
export function updatePlaybackState(
    playback: MediaPlaybackState,
    changes: Partial<MediaPlaybackState>,
    updatedBy: string | null,
): MediaPlaybackState {
    return {
        ...playback,
        ...changes,
        updatedAt: Date.now(),
        updatedBy,
    };
}