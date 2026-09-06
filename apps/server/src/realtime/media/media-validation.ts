import type {
    MediaItem,
    MediaType,
} from "@syncspace/shared";

function isValidYouTubeMediaId(
    value: unknown,
): value is string {
    return (
        typeof value === "string" &&
        /^[a-zA-Z0-9_-]{11}$/.test(
            value,
        )
    );
}

export function normalizeMedia(
    media: unknown,
    expectedMediaType: MediaType,
): MediaItem | null {
    if (
        !media ||
        typeof media !== "object"
    ) {
        return null;
    }

    const candidate =
        media as Record<
            string,
            unknown
        >;

    if (
        !isValidYouTubeMediaId(
            candidate.mediaId,
        )
    ) {
        return null;
    }

    if (
        candidate.mediaType !==
        expectedMediaType
    ) {
        return null;
    }

    if (
        typeof candidate.title !==
            "string" ||
        !candidate.title.trim()
    ) {
        return null;
    }

    const duration =
        typeof candidate.duration ===
            "number" &&
        Number.isFinite(
            candidate.duration,
        ) &&
        candidate.duration >= 0
            ? candidate.duration
            : null;

    const thumbnailUrl =
        typeof candidate.thumbnailUrl ===
            "string" &&
        candidate.thumbnailUrl.trim()
            ? candidate.thumbnailUrl.trim()
            : null;

    return {
        mediaId:
            candidate.mediaId,
        mediaType:
            expectedMediaType,
        title:
            candidate.title.trim(),
        duration,
        thumbnailUrl,
    };
}