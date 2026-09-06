import type { Server, Socket } from "socket.io";

import type {
    ClientToServerEvents,
    MediaItem,
    MediaPlaybackState,
    PlaybackMode,
    ServerToClientEvents,
} from "@syncspace/shared";

import {
    getActiveRoom,
    getParticipantBySocketId,
    setPlaybackMode,
    shuffleArray,
} from "../room-store";

import {
    normalizeMedia,
} from "../media/media-validation";

import {
    getCurrentPlaybackPosition,
} from "../media/media-playback";

const MAX_QUEUE_SIZE = 50;

const VALID_PLAYBACK_MODES: PlaybackMode[] = [
    "normal",
    "repeat_one",
    "repeat_queue",
    "shuffle",
];

type SocketServer = Server<
    ClientToServerEvents,
    ServerToClientEvents
>;

type SocketConnection = Socket<
    ClientToServerEvents,
    ServerToClientEvents
>;

type MusicQueueAddPayload =
    Parameters<
        ClientToServerEvents["music:queue-add"]
    >[0];

type MusicQueueRemovePayload =
    Parameters<
        ClientToServerEvents["music:queue-remove"]
    >[0];

type MusicSeekPayload =
    Parameters<
        ClientToServerEvents["music:seek"]
    >[0];

type MusicSetModePayload =
    Parameters<
        ClientToServerEvents["music:set-mode"]
    >[0];

type VideoQueueAddPayload =
    Parameters<
        ClientToServerEvents["video:queue-add"]
    >[0];

type VideoQueueRemovePayload =
    Parameters<
        ClientToServerEvents["video:queue-remove"]
    >[0];

type VideoSeekPayload =
    Parameters<
        ClientToServerEvents["video:seek"]
    >[0];

type VideoSetModePayload =
    Parameters<
        ClientToServerEvents["video:set-mode"]
    >[0];

type QueueAddPayload =
    | MusicQueueAddPayload
    | VideoQueueAddPayload;

type QueueRemovePayload =
    | MusicQueueRemovePayload
    | VideoQueueRemovePayload;

type SeekPayload =
    | MusicSeekPayload
    | VideoSeekPayload;

type SetModePayload =
    | MusicSetModePayload
    | VideoSetModePayload;

/* ---------------------------------------------------------
 * Context
 * --------------------------------------------------------- */

function getMediaContext(
    socket: SocketConnection,
) {
    const result =
        getParticipantBySocketId(
            socket.id,
        );

    if (!result) {
        return null;
    }

    const room =
        getActiveRoom(
            result.room.roomId,
        );

    if (!room) {
        return null;
    }

    return {
        room,
        participant:
            result.participant,
    };
}

/* ---------------------------------------------------------
 * Error helpers
 * --------------------------------------------------------- */

function emitQueueError(
    socket: SocketConnection,
    mediaType: "music" | "video",
    message: string,
) {
    if (
        mediaType === "music"
    ) {
        socket.emit(
            "music:queue-error",
            {
                message,
            },
        );

        return;
    }

    socket.emit(
        "video:queue-error",
        {
            message,
        },
    );
}

function emitPlaybackError(
    socket: SocketConnection,
    mediaType: "music" | "video",
    message: string,
) {
    if (
        mediaType === "music"
    ) {
        socket.emit(
            "music:playback-error",
            {
                message,
            },
        );

        return;
    }

    socket.emit(
        "video:playback-error",
        {
            message,
        },
    );
}

/* ---------------------------------------------------------
 * Host authorization
 * --------------------------------------------------------- */

function requireHost(
    socket: SocketConnection,
    mediaType: "music" | "video",
) {
    const context =
        getMediaContext(socket);

    if (!context) {
        emitPlaybackError(
            socket,
            mediaType,
            "You are not in a room",
        );

        return null;
    }

    if (
        context.room.type !==
        mediaType
    ) {
        emitPlaybackError(
            socket,
            mediaType,
            `${
                mediaType === "music"
                    ? "Music"
                    : "Video"
            } is not available in this room`,
        );

        return null;
    }

    if (
        !context.participant.isHost
    ) {
        emitPlaybackError(
            socket,
            mediaType,
            "Only the host can control playback",
        );

        return null;
    }

    return context;
}

/* ---------------------------------------------------------
 * Playback emission
 * --------------------------------------------------------- */

function emitPlayback(
    io: SocketServer,
    room: {
        code: string;
        playback: MediaPlaybackState;
    },
    mediaType: "music" | "video",
) {
    const playback: MediaPlaybackState = {
        ...room.playback,
        position:
            getCurrentPlaybackPosition(
                room.playback,
            ),
        updatedAt:
            room.playback.updatedAt,
    };

    room.playback =
        playback;

    if (
        mediaType === "music"
    ) {
        io.to(room.code).emit(
            "music:playback-updated",
            {
                playback,
            },
        );

        return;
    }

    io.to(room.code).emit(
        "video:playback-updated",
        {
            playback,
        },
    );
}

function emitPlaybackToSocket(
    socket: SocketConnection,
    room: {
        playback: MediaPlaybackState;
    },
    mediaType: "music" | "video",
) {
    /*
     * FIX: this snapshot must carry a fresh `updatedAt`, not the
     * room's last-changed timestamp.
     *
     * This function sends a TARGETED answer to a single
     * participant's resume request. If nothing else has changed
     * room-wide since the last broadcast, `position` here is
     * recomputed but was otherwise numerically identical to what
     * that participant already had (same mediaId / isPlaying /
     * updatedAt) — and the client correlates "is this a real
     * update" partly off of `updatedAt`. Reusing the stale
     * `room.playback.updatedAt` made this targeted answer
     * indistinguishable from data the client already had, so it
     * was being silently ignored — the exact cause of "participant
     * resume never completes". `position` is recomputed as of
     * right now, so stamping `updatedAt = Date.now()` alongside it
     * is also the philosophically correct pairing (this position
     * is accurate as of this instant). Note this intentionally
     * does NOT mutate `room.playback` — this is informational for
     * one participant, not a real state change to the shared room.
     */
    const playback: MediaPlaybackState = {
        ...room.playback,
        position:
            getCurrentPlaybackPosition(
                room.playback,
            ),
        updatedAt: Date.now(),
    };

    if (
        mediaType === "music"
    ) {
        socket.emit(
            "music:playback-updated",
            {
                playback,
            },
        );

        return;
    }

    socket.emit(
        "video:playback-updated",
        {
            playback,
        },
    );
}

/* ---------------------------------------------------------
 * Queue emission
 * --------------------------------------------------------- */

function emitQueue(
    io: SocketServer,
    room: {
        code: string;
        queue: MediaItem[];
    },
    mediaType: "music" | "video",
) {
    if (
        mediaType === "music"
    ) {
        io.to(room.code).emit(
            "music:queue-updated",
            {
                queue:
                    room.queue,
            },
        );

        return;
    }

    io.to(room.code).emit(
        "video:queue-updated",
        {
            queue:
                room.queue,
        },
    );
}

/* ---------------------------------------------------------
 * Shuffle
 * --------------------------------------------------------- */

function createShuffleOrder(
    queueLength: number,
    currentIndex: number,
): {
    order: number[];
    position: number;
} {
    if (
        queueLength <= 0
    ) {
        return {
            order: [],
            position: 0,
        };
    }

    const safeCurrentIndex =
        Math.min(
            Math.max(
                currentIndex,
                0,
            ),
            queueLength - 1,
        );

    const otherIndexes =
        Array.from(
            {
                length:
                    queueLength,
            },
            (
                _,
                index,
            ) => index,
        ).filter(
            (index) =>
                index !==
                safeCurrentIndex,
        );

    return {
        order: [
            safeCurrentIndex,
            ...shuffleArray(
                otherIndexes,
            ),
        ],
        position: 0,
    };
}

function rebuildShuffleAfterQueueChange(
    room: {
        queue: MediaItem[];
        playback: MediaPlaybackState;
        shuffleOrder: number[];
        shufflePosition: number;
    },
) {
    if (
        room.playback.mode !==
        "shuffle"
    ) {
        room.shuffleOrder =
            [];
        room.shufflePosition =
            0;

        return;
    }

    if (
        room.playback.currentIndex ===
        null
    ) {
        room.shuffleOrder =
            [];
        room.shufflePosition =
            0;

        return;
    }

    const shuffle =
        createShuffleOrder(
            room.queue.length,
            room.playback.currentIndex,
        );

    room.shuffleOrder =
        shuffle.order;

    room.shufflePosition =
        shuffle.position;
}

function getNextIndex(
    queueLength: number,
    currentIndex: number,
    mode: PlaybackMode,
    shuffleOrder: number[],
    shufflePosition: number,
): {
    index: number | null;
    shuffleOrder: number[];
    shufflePosition: number;
} {
    if (
        queueLength === 0
    ) {
        return {
            index: null,
            shuffleOrder: [],
            shufflePosition: 0,
        };
    }

    const safeCurrentIndex =
        Math.min(
            Math.max(
                currentIndex,
                0,
            ),
            queueLength - 1,
        );

    if (
        mode === "repeat_one"
    ) {
        return {
            index:
                safeCurrentIndex,
            shuffleOrder,
            shufflePosition,
        };
    }

    if (
        mode === "shuffle"
    ) {
        let order =
            shuffleOrder;

        let position =
            shufflePosition;

        if (
            order.length !==
                queueLength ||
            !order.includes(
                safeCurrentIndex,
            )
        ) {
            const shuffle =
                createShuffleOrder(
                    queueLength,
                    safeCurrentIndex,
                );

            order =
                shuffle.order;

            position =
                shuffle.position;
        }

        const nextPosition =
            position + 1;

        if (
            nextPosition <
            order.length
        ) {
            return {
                index:
                    order[
                        nextPosition
                    ],
                shuffleOrder:
                    order,
                shufflePosition:
                    nextPosition,
            };
        }

        const nextShuffle =
            createShuffleOrder(
                queueLength,
                safeCurrentIndex,
            );

        return {
            index:
                nextShuffle.order[0] ??
                null,
            shuffleOrder:
                nextShuffle.order,
            shufflePosition:
                0,
        };
    }

    let nextIndex =
        safeCurrentIndex + 1;

    if (
        nextIndex >=
        queueLength
    ) {
        if (
            mode ===
            "repeat_queue"
        ) {
            nextIndex = 0;
        } else {
            return {
                index: null,
                shuffleOrder,
                shufflePosition,
            };
        }
    }

    return {
        index:
            nextIndex,
        shuffleOrder,
        shufflePosition,
    };
}

function getPreviousIndex(
    queueLength: number,
    currentIndex: number,
    mode: PlaybackMode,
    shuffleOrder: number[],
    shufflePosition: number,
): {
    index: number | null;
    shuffleOrder: number[];
    shufflePosition: number;
} {
    if (
        queueLength === 0
    ) {
        return {
            index: null,
            shuffleOrder: [],
            shufflePosition: 0,
        };
    }

    const safeCurrentIndex =
        Math.min(
            Math.max(
                currentIndex,
                0,
            ),
            queueLength - 1,
        );

    if (
        mode === "shuffle"
    ) {
        if (
            shuffleOrder.length ===
                queueLength &&
            shufflePosition > 0
        ) {
            const previousPosition =
                shufflePosition - 1;

            return {
                index:
                    shuffleOrder[
                        previousPosition
                    ] ??
                    safeCurrentIndex,
                shuffleOrder,
                shufflePosition:
                    previousPosition,
            };
        }

        return {
            index:
                safeCurrentIndex,
            shuffleOrder,
            shufflePosition,
        };
    }

    let previousIndex =
        safeCurrentIndex - 1;

    if (
        previousIndex < 0
    ) {
        if (
            mode ===
            "repeat_queue"
        ) {
            previousIndex =
                queueLength - 1;
        } else {
            previousIndex = 0;
        }
    }

    return {
        index:
            previousIndex,
        shuffleOrder,
        shufflePosition,
    };
}

/* ---------------------------------------------------------
 * Queue add
 * --------------------------------------------------------- */

function handleQueueAdd(
    io: SocketServer,
    socket: SocketConnection,
    mediaType: "music" | "video",
    payload: QueueAddPayload,
) {
    const context =
        getMediaContext(socket);

    if (!context) {
        emitQueueError(
            socket,
            mediaType,
            "You are not in a room",
        );

        return;
    }

    const {
        room,
        participant,
    } = context;

    if (
        room.type !==
        mediaType
    ) {
        emitQueueError(
            socket,
            mediaType,
            `${
                mediaType === "music"
                    ? "Music"
                    : "Video"
            } is not available in this room`,
        );

        return;
    }

    if (
        !participant.isHost
    ) {
        emitQueueError(
            socket,
            mediaType,
            `Only the host can add ${
                mediaType ===
                "music"
                    ? "music"
                    : "videos"
            }`,
        );

        return;
    }

    if (
        room.queue.length >=
        MAX_QUEUE_SIZE
    ) {
        emitQueueError(
            socket,
            mediaType,
            "Queue is full",
        );

        return;
    }

    const media =
        normalizeMedia(
            payload.media,
            mediaType,
        );

    if (!media) {
        emitQueueError(
            socket,
            mediaType,
            "Invalid media data",
        );

        return;
    }

    room.queue.push(
        media,
    );

    if (
        room.playback.currentIndex ===
        null
    ) {
        room.playback = {
            ...room.playback,
            mediaId:
                media.mediaId,
            mediaType,
            position: 0,
            isPlaying: false,
            updatedAt:
                Date.now(),
            updatedBy:
                participant.participantId,
            currentIndex: 0,
        };

        room.shuffleOrder =
            [0];

        room.shufflePosition =
            0;
    } else if (
        room.playback.mode ===
        "shuffle"
    ) {
        rebuildShuffleAfterQueueChange(
            room,
        );
    }

    emitQueue(
        io,
        room,
        mediaType,
    );

    emitPlayback(
        io,
        room,
        mediaType,
    );
}

/* ---------------------------------------------------------
 * Queue remove
 * --------------------------------------------------------- */

function handleQueueRemove(
    io: SocketServer,
    socket: SocketConnection,
    mediaType: "music" | "video",
    payload: QueueRemovePayload,
) {
    const context =
        getMediaContext(socket);

    if (!context) {
        emitQueueError(
            socket,
            mediaType,
            "You are not in a room",
        );

        return;
    }

    const {
        room,
        participant,
    } = context;

    if (
        room.type !==
        mediaType
    ) {
        emitQueueError(
            socket,
            mediaType,
            `${
                mediaType === "music"
                    ? "Music"
                    : "Video"
            } is not available in this room`,
        );

        return;
    }

    if (
        !participant.isHost
    ) {
        emitQueueError(
            socket,
            mediaType,
            `Only the host can remove ${
                mediaType ===
                "music"
                    ? "music"
                    : "videos"
            }`,
        );

        return;
    }

    const index =
        payload.index;

    if (
        !Number.isInteger(
            index,
        ) ||
        index < 0 ||
        index >=
            room.queue.length
    ) {
        emitQueueError(
            socket,
            mediaType,
            "Invalid queue index",
        );

        return;
    }

    const currentIndex =
        room.playback.currentIndex;

    const wasCurrent =
        currentIndex ===
        index;

    room.queue.splice(
        index,
        1,
    );

    if (
        room.queue.length ===
        0
    ) {
        room.playback = {
            ...room.playback,
            mediaId: null,
            mediaType,
            position: 0,
            isPlaying: false,
            updatedAt:
                Date.now(),
            updatedBy:
                participant.participantId,
            currentIndex: null,
        };

        room.shuffleOrder =
            [];

        room.shufflePosition =
            0;

        emitQueue(
            io,
            room,
            mediaType,
        );

        emitPlayback(
            io,
            room,
            mediaType,
        );

        return;
    }

    if (
        wasCurrent
    ) {
        const newCurrentIndex =
            Math.min(
                index,
                room.queue.length -
                    1,
            );

        const newCurrentMedia =
            room.queue[
                newCurrentIndex
            ];

        room.playback = {
            ...room.playback,
            mediaId:
                newCurrentMedia.mediaId,
            mediaType,
            position: 0,
            isPlaying: true,
            updatedAt:
                Date.now(),
            updatedBy:
                participant.participantId,
            currentIndex:
                newCurrentIndex,
        };
    } else if (
        currentIndex !==
            null &&
        index <
            currentIndex
    ) {
        room.playback = {
            ...room.playback,
            currentIndex:
                currentIndex - 1,
        };
    }

    rebuildShuffleAfterQueueChange(
        room,
    );

    emitQueue(
        io,
        room,
        mediaType,
    );

    emitPlayback(
        io,
        room,
        mediaType,
    );
}

/* ---------------------------------------------------------
 * Play
 * --------------------------------------------------------- */

function handlePlay(
    io: SocketServer,
    socket: SocketConnection,
    mediaType: "music" | "video",
) {
    const context =
        getMediaContext(socket);

    if (!context) {
        emitPlaybackError(
            socket,
            mediaType,
            "You are not in a room",
        );

        return;
    }

    const {
        room,
        participant,
    } = context;

    if (
        room.type !==
        mediaType
    ) {
        emitPlaybackError(
            socket,
            mediaType,
            `${
                mediaType === "music"
                    ? "Music"
                    : "Video"
            } is not available in this room`,
        );

        return;
    }

    if (
        mediaType === "music"
    ) {
        if (
            !participant.isHost
        ) {
            emitPlaybackError(
                socket,
                mediaType,
                "Only the host can control playback",
            );

            return;
        }

        if (
            !room.playback.mediaId
        ) {
            emitPlaybackError(
                socket,
                mediaType,
                "No music is currently selected",
            );

            return;
        }

        const position =
            getCurrentPlaybackPosition(
                room.playback,
            );

        room.playback = {
            ...room.playback,
            position,
            isPlaying: true,
            updatedAt:
                Date.now(),
            updatedBy:
                participant.participantId,
        };

        emitPlayback(
            io,
            room,
            mediaType,
        );

        return;
    }

    if (
        !room.playback.mediaId
    ) {
        emitPlaybackError(
            socket,
            mediaType,
            "No video is currently selected",
        );

        return;
    }

    /*
     * Host Play:
     *
     * If the room is already playing, there is nothing
     * to change globally. The host is already part of
     * the authoritative timeline.
     */
    if (
        participant.isHost
    ) {
        const position =
            getCurrentPlaybackPosition(
                room.playback,
            );

        room.playback = {
            ...room.playback,
            position,
            isPlaying: true,
            updatedAt:
                Date.now(),
            updatedBy:
                participant.participantId,
        };

        emitPlayback(
            io,
            room,
            mediaType,
        );

        return;
    }

    /*
     * Participant Play:
     *
     * If the room is already playing, return only the
     * current authoritative position to this participant.
     */
    if (
        room.playback.isPlaying
    ) {
        emitPlaybackToSocket(
            socket,
            room,
            mediaType,
        );

        return;
    }

    /*
     * If the room is stopped, only the host should
     * restart the shared timeline.
     */
    emitPlaybackError(
        socket,
        mediaType,
        "Only the host can start shared playback",
    );
}

/* ---------------------------------------------------------
 * Pause
 * --------------------------------------------------------- */

function handlePause(
    io: SocketServer,
    socket: SocketConnection,
    mediaType: "music" | "video",
) {
    const context =
        getMediaContext(socket);

    if (!context) {
        emitPlaybackError(
            socket,
            mediaType,
            "You are not in a room",
        );

        return;
    }

    const {
        room,
        participant,
    } = context;

    if (
        room.type !==
        mediaType
    ) {
        emitPlaybackError(
            socket,
            mediaType,
            `${
                mediaType === "music"
                    ? "Music"
                    : "Video"
            } is not available in this room`,
        );

        return;
    }

    /*
     * MUSIC
     *
     * Preserve V1 host-only shared pause.
     */
    if (
        mediaType === "music"
    ) {
        if (
            !participant.isHost
        ) {
            emitPlaybackError(
                socket,
                mediaType,
                "Only the host can control playback",
            );

            return;
        }

        const position =
            getCurrentPlaybackPosition(
                room.playback,
            );

        room.playback = {
            ...room.playback,
            position,
            isPlaying: false,
            updatedAt:
                Date.now(),
            updatedBy:
                participant.participantId,
        };

        emitPlayback(
            io,
            room,
            mediaType,
        );

        return;
    }

    /*
     * VIDEO HOST PAUSE
     *
     * The host controls the authoritative room timeline.
     * Pausing the host therefore pauses every participant.
     */
    if (
        participant.isHost
    ) {
        const position =
            getCurrentPlaybackPosition(
                room.playback,
            );

        room.playback = {
            ...room.playback,
            position,
            isPlaying: false,
            updatedAt:
                Date.now(),
            updatedBy:
                participant.participantId,
        };

        emitPlayback(
            io,
            room,
            mediaType,
        );

        return;
    }

    /*
     * VIDEO PARTICIPANT PAUSE
     *
     * This intentionally does not modify room.playback.
     * The participant's frontend pauses only its own player.
     */
    return;
}

/* ---------------------------------------------------------
 * Seek
 * --------------------------------------------------------- */

function handleSeek(
    io: SocketServer,
    socket: SocketConnection,
    mediaType: "music" | "video",
    payload: SeekPayload,
) {
    const context =
        requireHost(
            socket,
            mediaType,
        );

    if (!context) {
        return;
    }

    const {
        room,
        participant,
    } = context;

    const position =
        payload.position;

    if (
        typeof position !==
            "number" ||
        !Number.isFinite(
            position,
        ) ||
        position < 0
    ) {
        emitPlaybackError(
            socket,
            mediaType,
            "Invalid playback position",
        );

        return;
    }

    const currentIndex =
        room.playback.currentIndex;

    const currentMedia =
        currentIndex !== null
            ? room.queue[
                  currentIndex
              ]
            : null;

    let safePosition =
        position;

    if (
        currentMedia?.duration !==
            null &&
        currentMedia?.duration !==
            undefined
    ) {
        safePosition =
            Math.min(
                position,
                currentMedia.duration,
            );
    }

    room.playback = {
        ...room.playback,
        position:
            safePosition,
        updatedAt:
            Date.now(),
        updatedBy:
            participant.participantId,
    };

    emitPlayback(
        io,
        room,
        mediaType,
    );
}

/* ---------------------------------------------------------
 * Next
 * --------------------------------------------------------- */

function handleNext(
    io: SocketServer,
    socket: SocketConnection,
    mediaType: "music" | "video",
) {
    const context =
        requireHost(
            socket,
            mediaType,
        );

    if (!context) {
        return;
    }

    const {
        room,
        participant,
    } = context;

    if (
        room.queue.length ===
        0
    ) {
        return;
    }

    const currentIndex =
        room.playback.currentIndex ??
        0;

    const next =
        getNextIndex(
            room.queue.length,
            currentIndex,
            room.playback.mode,
            room.shuffleOrder,
            room.shufflePosition,
        );

    room.shuffleOrder =
        next.shuffleOrder;

    room.shufflePosition =
        next.shufflePosition;

    if (
        next.index === null
    ) {
        const currentMedia =
            room.queue[
                currentIndex
            ];

        if (!currentMedia) {
            return;
        }

        room.playback = {
            ...room.playback,
            mediaId:
                currentMedia.mediaId,
            mediaType,
            position:
                currentMedia.duration ??
                0,
            isPlaying: false,
            updatedAt:
                Date.now(),
            updatedBy:
                participant.participantId,
            currentIndex:
                currentIndex,
        };

        emitPlayback(
            io,
            room,
            mediaType,
        );

        return;
    }

    const nextMedia =
        room.queue[
            next.index
        ];

    if (!nextMedia) {
        return;
    }

    /*
     * FIX: preserve the room's current isPlaying state instead of
     * forcing it to true. An explicit Next/Previous should not
     * start playback that was paused, and should keep playing if
     * it was already playing. (Natural end-of-track advancement in
     * handleEnded() below is a separate, correct case: it only
     * ever fires while the room was already playing, so forcing
     * isPlaying: true there remains correct.)
     */
    room.playback = {
        ...room.playback,
        mediaId:
            nextMedia.mediaId,
        mediaType,
        position: 0,
        isPlaying:
            room.playback.isPlaying,
        updatedAt:
            Date.now(),
        updatedBy:
            participant.participantId,
        currentIndex:
            next.index,
    };

    emitPlayback(
        io,
        room,
        mediaType,
    );
}

/* ---------------------------------------------------------
 * Previous
 * --------------------------------------------------------- */

function handlePrevious(
    io: SocketServer,
    socket: SocketConnection,
    mediaType: "music" | "video",
) {
    const context =
        requireHost(
            socket,
            mediaType,
        );

    if (!context) {
        return;
    }

    const {
        room,
        participant,
    } = context;

    if (
        room.queue.length ===
        0
    ) {
        return;
    }

    const currentIndex =
        room.playback.currentIndex ??
        0;

    const previous =
        getPreviousIndex(
            room.queue.length,
            currentIndex,
            room.playback.mode,
            room.shuffleOrder,
            room.shufflePosition,
        );

    room.shuffleOrder =
        previous.shuffleOrder;

    room.shufflePosition =
        previous.shufflePosition;

    if (
        previous.index ===
        null
    ) {
        return;
    }

    const previousMedia =
        room.queue[
            previous.index
        ];

    if (!previousMedia) {
        return;
    }

    /*
     * FIX: same as handleNext() above — preserve the room's
     * current isPlaying state instead of forcing it to true.
     */
    room.playback = {
        ...room.playback,
        mediaId:
            previousMedia.mediaId,
        mediaType,
        position: 0,
        isPlaying:
            room.playback.isPlaying,
        updatedAt:
            Date.now(),
        updatedBy:
            participant.participantId,
        currentIndex:
            previous.index,
    };

    emitPlayback(
        io,
        room,
        mediaType,
    );
}

/* ---------------------------------------------------------
 * Playback mode
 * --------------------------------------------------------- */

function handleSetMode(
    io: SocketServer,
    socket: SocketConnection,
    mediaType: "music" | "video",
    payload: SetModePayload,
) {
    const context =
        requireHost(
            socket,
            mediaType,
        );

    if (!context) {
        return;
    }

    const {
        room,
        participant,
    } = context;

    const mode =
        payload.mode;

    if (
        !VALID_PLAYBACK_MODES.includes(
            mode,
        )
    ) {
        emitPlaybackError(
            socket,
            mediaType,
            "Invalid playback mode",
        );

        return;
    }

    setPlaybackMode(
        room.roomId,
        mode,
    );

    room.playback = {
        ...room.playback,
        mode,
        updatedAt:
            Date.now(),
        updatedBy:
            participant.participantId,
    };

    if (
        mode === "shuffle"
    ) {
        if (
            room.playback.currentIndex !==
                null &&
            room.queue.length >
                0
        ) {
            const shuffle =
                createShuffleOrder(
                    room.queue.length,
                    room.playback
                        .currentIndex,
                );

            room.shuffleOrder =
                shuffle.order;

            room.shufflePosition =
                shuffle.position;
        } else {
            room.shuffleOrder =
                [];

            room.shufflePosition =
                0;
        }
    } else {
        room.shuffleOrder =
            [];

        room.shufflePosition =
            0;
    }

    emitPlayback(
        io,
        room,
        mediaType,
    );
}

/* ---------------------------------------------------------
 * Ended
 * --------------------------------------------------------- */

function handleEnded(
    io: SocketServer,
    socket: SocketConnection,
    mediaType: "music" | "video",
) {
    const context =
        requireHost(
            socket,
            mediaType,
        );

    if (!context) {
        return;
    }

    const {
        room,
        participant,
    } = context;

    if (
        room.queue.length ===
        0
    ) {
        return;
    }

    const currentIndex =
        room.playback.currentIndex;

    if (
        currentIndex === null
    ) {
        return;
    }

    if (
        room.playback.mode ===
        "repeat_one"
    ) {
        const currentMedia =
            room.queue[
                currentIndex
            ];

        if (!currentMedia) {
            return;
        }

        room.playback = {
            ...room.playback,
            mediaId:
                currentMedia.mediaId,
            mediaType,
            position: 0,
            isPlaying: true,
            updatedAt:
                Date.now(),
            updatedBy:
                participant.participantId,
            currentIndex,
        };

        emitPlayback(
            io,
            room,
            mediaType,
        );

        return;
    }

    const next =
        getNextIndex(
            room.queue.length,
            currentIndex,
            room.playback.mode,
            room.shuffleOrder,
            room.shufflePosition,
        );

    room.shuffleOrder =
        next.shuffleOrder;

    room.shufflePosition =
        next.shufflePosition;

    if (
        next.index === null
    ) {
        const currentMedia =
            room.queue[
                currentIndex
            ];

        if (!currentMedia) {
            return;
        }

        room.playback = {
            ...room.playback,
            mediaId:
                currentMedia.mediaId,
            mediaType,
            position:
                currentMedia.duration ??
                0,
            isPlaying: false,
            updatedAt:
                Date.now(),
            updatedBy:
                participant.participantId,
            currentIndex,
        };

        emitPlayback(
            io,
            room,
            mediaType,
        );

        return;
    }

    const nextMedia =
        room.queue[
            next.index
        ];

    if (!nextMedia) {
        return;
    }

    /*
     * Note: forcing isPlaying: true here (unlike handleNext /
     * handlePrevious above) remains correct — a natural ENDED
     * event only ever fires while the room was actually playing,
     * so continuing to play the next track matches that state.
     */
    room.playback = {
        ...room.playback,
        mediaId:
            nextMedia.mediaId,
        mediaType,
        position: 0,
        isPlaying: true,
        updatedAt:
            Date.now(),
        updatedBy:
            participant.participantId,
        currentIndex:
            next.index,
    };

    emitPlayback(
        io,
        room,
        mediaType,
    );
}

/* ---------------------------------------------------------
 * Registration
 * --------------------------------------------------------- */

export function registerMediaHandlers(
    io: SocketServer,
    socket: SocketConnection,
) {
    socket.on(
        "music:queue-add",
        (payload) => {
            handleQueueAdd(
                io,
                socket,
                "music",
                payload,
            );
        },
    );

    socket.on(
        "music:queue-remove",
        (payload) => {
            handleQueueRemove(
                io,
                socket,
                "music",
                payload,
            );
        },
    );

    socket.on(
        "music:play",
        () => {
            handlePlay(
                io,
                socket,
                "music",
            );
        },
    );

    socket.on(
        "music:pause",
        () => {
            handlePause(
                io,
                socket,
                "music",
            );
        },
    );

    socket.on(
        "music:seek",
        (payload) => {
            handleSeek(
                io,
                socket,
                "music",
                payload,
            );
        },
    );

    socket.on(
        "music:next",
        () => {
            handleNext(
                io,
                socket,
                "music",
            );
        },
    );

    socket.on(
        "music:previous",
        () => {
            handlePrevious(
                io,
                socket,
                "music",
            );
        },
    );

    socket.on(
        "music:set-mode",
        (payload) => {
            handleSetMode(
                io,
                socket,
                "music",
                payload,
            );
        },
    );

    socket.on(
        "music:ended",
        () => {
            handleEnded(
                io,
                socket,
                "music",
            );
        },
    );

    socket.on(
        "video:queue-add",
        (payload) => {
            handleQueueAdd(
                io,
                socket,
                "video",
                payload,
            );
        },
    );

    socket.on(
        "video:queue-remove",
        (payload) => {
            handleQueueRemove(
                io,
                socket,
                "video",
                payload,
            );
        },
    );

    socket.on(
        "video:play",
        () => {
            handlePlay(
                io,
                socket,
                "video",
            );
        },
    );

    socket.on(
        "video:pause",
        () => {
            handlePause(
                io,
                socket,
                "video",
            );
        },
    );

    socket.on(
        "video:seek",
        (payload) => {
            handleSeek(
                io,
                socket,
                "video",
                payload,
            );
        },
    );

    socket.on(
        "video:next",
        () => {
            handleNext(
                io,
                socket,
                "video",
            );
        },
    );

    socket.on(
        "video:previous",
        () => {
            handlePrevious(
                io,
                socket,
                "video",
            );
        },
    );

    socket.on(
        "video:set-mode",
        (payload) => {
            handleSetMode(
                io,
                socket,
                "video",
                payload,
            );
        },
    );

    socket.on(
        "video:ended",
        () => {
            handleEnded(
                io,
                socket,
                "video",
            );
        },
    );
}