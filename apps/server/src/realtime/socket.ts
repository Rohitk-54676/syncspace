import { randomUUID } from "node:crypto";
import type { Server } from "socket.io";
import type {
    MediaPlaybackState,
    PlaybackMode,
    MediaItem,
    ClientToServerEvents,
    ServerToClientEvents,
} from "@syncspace/shared";
import { prisma } from "../lib/prisma";

import {
    addParticipant,
    assignNextAvailableSeat,
    cancelPendingDisconnect,
    changeParticipantSeat,
    createActiveRoom,
    getActiveRoom,
    getParticipantBySocketId,
    removeParticipant,
    scheduleParticipantDisconnect,
    setPlaybackMode,
    shuffleArray,
    transferHost,
} from "./room-store";

const MAX_MUSIC_QUEUE_SIZE = 50;
const MAX_CHAT_MESSAGE_LENGTH = 500;
const MAX_DISPLAY_NAME_LENGTH = 30;

const VALID_PLAYBACK_MODES: PlaybackMode[] = [
    "normal",
    "repeat_one",
    "repeat_queue",
    "shuffle",
];

function getCurrentPlaybackPosition(
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

function emitPlayback(
    io: Server<
        ClientToServerEvents,
        ServerToClientEvents
    >,
    room: {
        code: string;
        playback: MediaPlaybackState;
    },
) {
    /*
     * Send the current authoritative position rather than an old
     * position when the song is currently playing.
     */
    const playback = {
        ...room.playback,
        position:
            getCurrentPlaybackPosition(
                room.playback,
            ),
        updatedAt: Date.now(),
    };

    /*
     * Keep the room's authoritative state normalized as well.
     */
    room.playback = playback;

    io.to(room.code).emit(
        "music:playback-updated",
        {
            playback,
        },
    );
}

function createShuffleOrder(
    queueLength: number,
    currentIndex: number,
): {
    order: number[];
    position: number;
} {
    if (queueLength <= 0) {
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
                length: queueLength,
            },
            (_, index) => index,
        ).filter(
            (index) =>
                index !==
                safeCurrentIndex,
        );

    const shuffledOthers =
        shuffleArray(
            otherIndexes,
        );

    return {
        order: [
            safeCurrentIndex,
            ...shuffledOthers,
        ],
        position: 0,
    };
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
    if (queueLength === 0) {
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

    if (mode === "repeat_one") {
        return {
            index: safeCurrentIndex,
            shuffleOrder,
            shufflePosition,
        };
    }

    if (mode === "shuffle") {
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
                    order[nextPosition],
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
            shufflePosition: 0,
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
        index: nextIndex,
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
    if (queueLength === 0) {
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
                    ] ?? safeCurrentIndex,
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
        index: previousIndex,
        shuffleOrder,
        shufflePosition,
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
        room.shuffleOrder = [];
        room.shufflePosition = 0;

        return;
    }

    if (
        room.playback.currentIndex ===
        null
    ) {
        room.shuffleOrder = [];
        room.shufflePosition = 0;

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

function isValidYouTubeMediaId(
    value: unknown,
): value is string {
    return (
        typeof value ===
        "string" &&
        /^[a-zA-Z0-9_-]{11}$/.test(
            value,
        )
    );
}

function normalizeMedia(
    media: unknown,
): MediaItem | null {
    if (
        !media ||
        typeof media !==
        "object"
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
        "music"
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
        mediaType: "music",
        title:
            candidate.title.trim(),
        duration,
        thumbnailUrl,
    };
}

async function getPersistentRoom(
    roomId: string,
) {
    const room =
        await prisma.room.findUnique({
            where: {
                id: roomId,
            },
        });

    if (!room) {
        return {
            room: null,
            error: "Room not found",
        };
    }

    if (
        room.expiresAt.getTime() <=
        Date.now()
    ) {
        return {
            room: null,
            error: "Room has expired",
        };
    }

    return {
        room,
        error: null,
    };
}

function emitParticipants(
    io: Server<
        ClientToServerEvents,
        ServerToClientEvents
    >,
    room: {
        code: string;
        participants: Map<
            string,
            {
                participantId: string;
                displayName: string;
                socketId: string;
                seat: number | null;
                isHost: boolean;
            }
        >;
    },
) {
    io.to(room.code).emit(
        "room:participants",
        {
            participants:
                Array.from(
                    room.participants.values(),
                ),
        },
    );
}

export function registerSocketHandlers(
    io: Server<
        ClientToServerEvents,
        ServerToClientEvents
    >,
) {
    io.on(
        "connection",
        (socket) => {
            console.log(
                `Socket connected: ${socket.id}`,
            );

            // ---------------------------------------------------------
            // ROOM JOIN
            // ---------------------------------------------------------

            socket.on(
                "room:join",
                async (payload) => {
                    try {
                        const {
                            roomId,
                            participantId,
                            displayName,
                        } = payload ?? {};

                        if (
                            typeof roomId !==
                            "string" ||
                            !roomId.trim() ||
                            typeof participantId !==
                            "string" ||
                            !participantId.trim() ||
                            typeof displayName !==
                            "string"
                        ) {
                            socket.emit(
                                "room:error",
                                {
                                    message:
                                        "Invalid room join payload",
                                },
                            );

                            return;
                        }

                        const trimmedDisplayName =
                            displayName.trim();

                        if (
                            !trimmedDisplayName ||
                            trimmedDisplayName.length >
                            MAX_DISPLAY_NAME_LENGTH
                        ) {
                            socket.emit(
                                "room:error",
                                {
                                    message:
                                        "Invalid display name",
                                },
                            );

                            return;
                        }

                        const persistent =
                            await getPersistentRoom(
                                roomId,
                            );

                        if (
                            !persistent.room
                        ) {
                            socket.emit(
                                "room:error",
                                {
                                    message:
                                        persistent.error ??
                                        "Room not found",
                                },
                            );

                            return;
                        }

                        const room =
                            persistent.room;

                        let activeRoom =
                            getActiveRoom(
                                room.id,
                            );

                        if (!activeRoom) {
                            const roomType =
                                room.type ===
                                    "MUSIC"
                                    ? "music"
                                    : "video";

                            activeRoom =
                                createActiveRoom({
                                    roomId:
                                        room.id,
                                    code:
                                        room.code,
                                    type:
                                        roomType,
                                    maxSeats:
                                        room.maxSeats,
                                    participants:
                                        new Map(),
                                    queue: [],
                                    playback: {
                                        mediaId:
                                            null,
                                        mediaType:
                                            roomType,
                                        position: 0,
                                        isPlaying:
                                            false,
                                        updatedAt:
                                            Date.now(),
                                        updatedBy:
                                            null,
                                        currentIndex:
                                            null,
                                        mode:
                                            "normal",
                                    },
                                    shuffleOrder:
                                        [],
                                    shufflePosition:
                                        0,
                                    createdAt:
                                        room.createdAt.getTime(),
                                });
                        }

                        const existingParticipant =
                            activeRoom.participants.get(
                                participantId,
                            );

                        /*
                         * Cancel a pending disconnect before checking capacity.
                         * This lets a reconnect reclaim its original seat.
                         */
                        cancelPendingDisconnect(
                            room.id,
                            participantId,
                        );

                        if (
                            activeRoom.participants.size >=
                            activeRoom.maxSeats &&
                            !existingParticipant
                        ) {
                            socket.emit(
                                "room:error",
                                {
                                    message:
                                        "Room is full",
                                },
                            );

                            return;
                        }

                        /*
                         * If this participant already has another socket,
                         * the new connection replaces the old socket.
                         *
                         * The old socket's disconnect event will not find
                         * this participant by its old socketId and therefore
                         * cannot remove the reconnected participant.
                         */
                        const isFirstParticipant =
                            activeRoom.participants.size ===
                            0;

                        const participant =
                            addParticipant(
                                room.id,
                                {
                                    participantId:
                                        participantId.trim(),
                                    displayName:
                                        trimmedDisplayName,
                                    socketId:
                                        socket.id,
                                    seat:
                                        existingParticipant?.seat ??
                                        null,
                                    isHost:
                                        existingParticipant?.isHost ??
                                        isFirstParticipant,
                                },
                            );

                        if (!participant) {
                            socket.emit(
                                "room:error",
                                {
                                    message:
                                        "Unable to join room",
                                },
                            );

                            return;
                        }

                        assignNextAvailableSeat(
                            room.id,
                            participant.participantId,
                        );

                        socket.join(
                            room.code,
                        );

                        socket.emit(
                            "room:joined",
                            {
                                room: {
                                    id: room.id,
                                    code:
                                        room.code,
                                    type:
                                        room.type ===
                                            "MUSIC"
                                            ? "music"
                                            : "video",
                                    maxSeats:
                                        room.maxSeats,
                                },
                                participant,
                            },
                        );

                        socket.emit(
                            "music:queue-updated",
                            {
                                queue:
                                    activeRoom.queue,
                            },
                        );

                        socket.emit(
                            "music:playback-updated",
                            {
                                playback: {
                                    ...activeRoom.playback,
                                    position:
                                        getCurrentPlaybackPosition(
                                            activeRoom.playback,
                                        ),
                                },
                            },
                        );

                        emitParticipants(
                            io,
                            activeRoom,
                        );
                    } catch (error) {
                        console.error(
                            "Socket room join failed:",
                            error,
                        );

                        socket.emit(
                            "room:error",
                            {
                                message:
                                    "Unable to join room",
                            },
                        );
                    }
                },
            );

            // ---------------------------------------------------------
            // SEAT CHANGE
            // ---------------------------------------------------------

            socket.on(
                "room:seat-change",
                (payload) => {
                    try {
                        const {
                            participantId,
                            seat,
                        } = payload ?? {};

                        if (
                            typeof participantId !==
                            "string" ||
                            !Number.isInteger(
                                seat,
                            )
                        ) {
                            socket.emit(
                                "room:seat-error",
                                {
                                    message:
                                        "Invalid seat request",
                                },
                            );

                            return;
                        }

                        const result =
                            getParticipantBySocketId(
                                socket.id,
                            );

                        if (!result) {
                            socket.emit(
                                "room:seat-error",
                                {
                                    message:
                                        "You are not in a room",
                                },
                            );

                            return;
                        }

                        const {
                            room,
                            participant,
                        } = result;

                        if (
                            participant.participantId !==
                            participantId
                        ) {
                            socket.emit(
                                "room:seat-error",
                                {
                                    message:
                                        "Invalid participant",
                                },
                            );

                            return;
                        }

                        const seatResult =
                            changeParticipantSeat(
                                room.roomId,
                                participantId,
                                seat,
                            );

                        if (
                            !seatResult.success
                        ) {
                            socket.emit(
                                "room:seat-error",
                                {
                                    message:
                                        seatResult.error ??
                                        "Unable to change seat",
                                },
                            );

                            return;
                        }

                        const activeRoom =
                            getActiveRoom(
                                room.roomId,
                            );

                        if (!activeRoom) {
                            return;
                        }

                        emitParticipants(
                            io,
                            activeRoom,
                        );
                    } catch (error) {
                        console.error(
                            "Seat change failed:",
                            error,
                        );

                        socket.emit(
                            "room:seat-error",
                            {
                                message:
                                    "Unable to change seat",
                            },
                        );
                    }
                },
            );

            // ---------------------------------------------------------
            // CHAT
            // ---------------------------------------------------------

            socket.on(
                "chat:send",
                (payload) => {
                    try {
                        const {
                            message,
                        } = payload ?? {};

                        if (
                            typeof message !==
                            "string"
                        ) {
                            socket.emit(
                                "chat:error",
                                {
                                    message:
                                        "Invalid chat message",
                                },
                            );

                            return;
                        }

                        const trimmedMessage =
                            message.trim();

                        if (
                            !trimmedMessage
                        ) {
                            socket.emit(
                                "chat:error",
                                {
                                    message:
                                        "Message cannot be empty",
                                },
                            );

                            return;
                        }

                        if (
                            trimmedMessage.length >
                            MAX_CHAT_MESSAGE_LENGTH
                        ) {
                            socket.emit(
                                "chat:error",
                                {
                                    message:
                                        "Message must be 500 characters or fewer",
                                },
                            );

                            return;
                        }

                        const result =
                            getParticipantBySocketId(
                                socket.id,
                            );

                        if (!result) {
                            socket.emit(
                                "chat:error",
                                {
                                    message:
                                        "You are not in a room",
                                },
                            );

                            return;
                        }

                        const {
                            room,
                            participant,
                        } = result;

                        const chatMessage = {
                            id: randomUUID(),
                            participantId:
                                participant.participantId,
                            displayName:
                                participant.displayName,
                            message:
                                trimmedMessage,
                            createdAt:
                                Date.now(),
                        };

                        io.to(
                            room.code,
                        ).emit(
                            "chat:message",
                            chatMessage,
                        );
                    } catch (error) {
                        console.error(
                            "Chat message failed:",
                            error,
                        );

                        socket.emit(
                            "chat:error",
                            {
                                message:
                                    "Unable to send message",
                            },
                        );
                    }
                },
            );

            // ---------------------------------------------------------
            // MUSIC QUEUE ADD
            // ---------------------------------------------------------

            socket.on(
                "music:queue-add",
                (payload) => {
                    try {
                        const result =
                            getParticipantBySocketId(
                                socket.id,
                            );

                        if (!result) {
                            socket.emit(
                                "music:queue-error",
                                {
                                    message:
                                        "You are not in a room",
                                },
                            );

                            return;
                        }

                        const {
                            room,
                            participant,
                        } = result;

                        if (
                            room.type !==
                            "music"
                        ) {
                            socket.emit(
                                "music:queue-error",
                                {
                                    message:
                                        "Music is not available in this room",
                                },
                            );

                            return;
                        }

                        if (
                            !participant.isHost
                        ) {
                            socket.emit(
                                "music:queue-error",
                                {
                                    message:
                                        "Only the host can add music",
                                },
                            );

                            return;
                        }

                        const activeRoom =
                            getActiveRoom(
                                room.roomId,
                            );

                        if (!activeRoom) {
                            socket.emit(
                                "music:queue-error",
                                {
                                    message:
                                        "Room not found",
                                },
                            );

                            return;
                        }

                        if (
                            activeRoom.queue
                                .length >=
                            MAX_MUSIC_QUEUE_SIZE
                        ) {
                            socket.emit(
                                "music:queue-error",
                                {
                                    message:
                                        `Queue cannot contain more than ${MAX_MUSIC_QUEUE_SIZE} songs`,
                                },
                            );

                            return;
                        }

                        const mediaItem =
                            normalizeMedia(
                                payload?.media,
                            );

                        if (!mediaItem) {
                            socket.emit(
                                "music:queue-error",
                                {
                                    message:
                                        "Invalid media data",
                                },
                            );

                            return;
                        }

                        activeRoom.queue.push(
                            mediaItem,
                        );

                        if (
                            activeRoom.playback
                                .currentIndex ===
                            null
                        ) {
                            activeRoom.playback =
                            {
                                ...activeRoom.playback,
                                mediaId:
                                    mediaItem.mediaId,
                                mediaType:
                                    "music",
                                position: 0,
                                isPlaying:
                                    false,
                                updatedAt:
                                    Date.now(),
                                updatedBy:
                                    participant.participantId,
                                currentIndex:
                                    0,
                            };

                            activeRoom.shuffleOrder =
                                [0];

                            activeRoom.shufflePosition =
                                0;
                        } else if (
                            activeRoom.playback
                                .mode ===
                            "shuffle"
                        ) {
                            /*
                             * Preserve the current song at the front while adding
                             * the new item into the shuffle pool.
                             */
                            const currentIndex =
                                activeRoom.playback
                                    .currentIndex;

                            if (
                                currentIndex !==
                                null
                            ) {
                                const otherIndexes =
                                    Array.from(
                                        {
                                            length:
                                                activeRoom
                                                    .queue
                                                    .length,
                                        },
                                        (_, index) =>
                                            index,
                                    ).filter(
                                        (index) =>
                                            index !==
                                            currentIndex,
                                    );

                                activeRoom.shuffleOrder =
                                    [
                                        currentIndex,
                                        ...shuffleArray(
                                            otherIndexes,
                                        ),
                                    ];

                                activeRoom.shufflePosition =
                                    0;
                            }
                        }

                        io.to(
                            activeRoom.code,
                        ).emit(
                            "music:queue-updated",
                            {
                                queue:
                                    activeRoom.queue,
                            },
                        );

                        emitPlayback(
                            io,
                            activeRoom,
                        );
                    } catch (error) {
                        console.error(
                            "Music queue add failed:",
                            error,
                        );

                        socket.emit(
                            "music:queue-error",
                            {
                                message:
                                    "Unable to add music",
                            },
                        );
                    }
                },
            );

            // ---------------------------------------------------------
            // MUSIC QUEUE REMOVE
            // ---------------------------------------------------------

            socket.on(
                "music:queue-remove",
                (payload) => {
                    try {
                        const {
                            index,
                        } = payload ?? {};

                        if (
                            !Number.isInteger(
                                index,
                            )
                        ) {
                            socket.emit(
                                "music:queue-error",
                                {
                                    message:
                                        "Invalid queue index",
                                },
                            );

                            return;
                        }

                        const result =
                            getParticipantBySocketId(
                                socket.id,
                            );

                        if (!result) {
                            socket.emit(
                                "music:queue-error",
                                {
                                    message:
                                        "You are not in a room",
                                },
                            );

                            return;
                        }

                        const {
                            room,
                            participant,
                        } = result;

                        if (
                            room.type !==
                            "music"
                        ) {
                            socket.emit(
                                "music:queue-error",
                                {
                                    message:
                                        "Music is not available in this room",
                                },
                            );

                            return;
                        }

                        if (
                            !participant.isHost
                        ) {
                            socket.emit(
                                "music:queue-error",
                                {
                                    message:
                                        "Only the host can remove music",
                                },
                            );

                            return;
                        }

                        const activeRoom =
                            getActiveRoom(
                                room.roomId,
                            );

                        if (!activeRoom) {
                            socket.emit(
                                "music:queue-error",
                                {
                                    message:
                                        "Room not found",
                                },
                            );

                            return;
                        }

                        if (
                            index < 0 ||
                            index >=
                            activeRoom.queue
                                .length
                        ) {
                            socket.emit(
                                "music:queue-error",
                                {
                                    message:
                                        "Queue item not found",
                                },
                            );

                            return;
                        }

                        const currentIndex =
                            activeRoom.playback
                                .currentIndex;

                        const wasCurrent =
                            currentIndex ===
                            index;

                        activeRoom.queue.splice(
                            index,
                            1,
                        );

                        // -------------------------------------------------
                        // EMPTY QUEUE
                        // -------------------------------------------------

                        if (
                            activeRoom.queue
                                .length === 0
                        ) {
                            activeRoom.playback =
                            {
                                ...activeRoom.playback,
                                mediaId:
                                    null,
                                mediaType:
                                    "music",
                                position: 0,
                                isPlaying:
                                    false,
                                updatedAt:
                                    Date.now(),
                                updatedBy:
                                    participant.participantId,
                                currentIndex:
                                    null,
                            };

                            activeRoom.shuffleOrder =
                                [];
                            activeRoom.shufflePosition =
                                0;

                            io.to(
                                activeRoom.code,
                            ).emit(
                                "music:queue-updated",
                                {
                                    queue: [],
                                },
                            );

                            emitPlayback(
                                io,
                                activeRoom,
                            );

                            return;
                        }

                        // -------------------------------------------------
                        // CURRENT SONG WAS REMOVED
                        // -------------------------------------------------

                        if (wasCurrent) {
                            const newCurrentIndex =
                                Math.min(
                                    index,
                                    activeRoom.queue
                                        .length - 1,
                                );

                            const newCurrentMedia =
                                activeRoom.queue[
                                newCurrentIndex
                                ];

                            activeRoom.playback =
                            {
                                ...activeRoom.playback,
                                mediaId:
                                    newCurrentMedia.mediaId,
                                mediaType:
                                    "music",
                                position: 0,
                                isPlaying:
                                    true,
                                updatedAt:
                                    Date.now(),
                                updatedBy:
                                    participant.participantId,
                                currentIndex:
                                    newCurrentIndex,
                            };
                        }

                        // -------------------------------------------------
                        // ITEM BEFORE CURRENT WAS REMOVED
                        // -------------------------------------------------

                        else if (
                            currentIndex !==
                            null &&
                            index <
                            currentIndex
                        ) {
                            activeRoom.playback =
                            {
                                ...activeRoom.playback,
                                currentIndex:
                                    currentIndex -
                                    1,
                            };
                        }

                        rebuildShuffleAfterQueueChange(
                            activeRoom,
                        );

                        io.to(
                            activeRoom.code,
                        ).emit(
                            "music:queue-updated",
                            {
                                queue:
                                    activeRoom.queue,
                            },
                        );

                        emitPlayback(
                            io,
                            activeRoom,
                        );
                    } catch (error) {
                        console.error(
                            "Music queue remove failed:",
                            error,
                        );

                        socket.emit(
                            "music:queue-error",
                            {
                                message:
                                    "Unable to remove music",
                            },
                        );
                    }
                },
            );

            // ---------------------------------------------------------
            // MUSIC PLAY
            // ---------------------------------------------------------

            socket.on(
                "music:play",
                () => {
                    try {
                        const result =
                            getParticipantBySocketId(
                                socket.id,
                            );

                        if (!result) {
                            socket.emit(
                                "music:playback-error",
                                {
                                    message:
                                        "You are not in a room",
                                },
                            );

                            return;
                        }

                        const {
                            room,
                            participant,
                        } = result;

                        if (
                            room.type !==
                            "music"
                        ) {
                            socket.emit(
                                "music:playback-error",
                                {
                                    message:
                                        "Playback is only available in music rooms",
                                },
                            );

                            return;
                        }

                        if (
                            !participant.isHost
                        ) {
                            socket.emit(
                                "music:playback-error",
                                {
                                    message:
                                        "Only the host can control playback",
                                },
                            );

                            return;
                        }

                        if (
                            !room.playback
                                .mediaId
                        ) {
                            socket.emit(
                                "music:playback-error",
                                {
                                    message:
                                        "No music is currently selected",
                                },
                            );

                            return;
                        }

                        const position =
                            getCurrentPlaybackPosition(
                                room.playback,
                            );

                        room.playback =
                        {
                            ...room.playback,
                            position,
                            isPlaying:
                                true,
                            updatedAt:
                                Date.now(),
                            updatedBy:
                                participant.participantId,
                        };

                        emitPlayback(
                            io,
                            room,
                        );
                    } catch (error) {
                        console.error(
                            "Music play failed:",
                            error,
                        );

                        socket.emit(
                            "music:playback-error",
                            {
                                message:
                                    "Unable to start playback",
                            },
                        );
                    }
                },
            );

            // ---------------------------------------------------------
            // MUSIC PAUSE
            // ---------------------------------------------------------

            socket.on(
                "music:pause",
                () => {
                    try {
                        const result =
                            getParticipantBySocketId(
                                socket.id,
                            );

                        if (!result) {
                            socket.emit(
                                "music:playback-error",
                                {
                                    message:
                                        "You are not in a room",
                                },
                            );

                            return;
                        }

                        const {
                            room,
                            participant,
                        } = result;

                        if (
                            room.type !==
                            "music"
                        ) {
                            socket.emit(
                                "music:playback-error",
                                {
                                    message:
                                        "Playback is only available in music rooms",
                                },
                            );

                            return;
                        }

                        if (
                            !participant.isHost
                        ) {
                            socket.emit(
                                "music:playback-error",
                                {
                                    message:
                                        "Only the host can control playback",
                                },
                            );

                            return;
                        }

                        const position =
                            getCurrentPlaybackPosition(
                                room.playback,
                            );

                        room.playback =
                        {
                            ...room.playback,
                            position,
                            isPlaying:
                                false,
                            updatedAt:
                                Date.now(),
                            updatedBy:
                                participant.participantId,
                        };

                        emitPlayback(
                            io,
                            room,
                        );
                    } catch (error) {
                        console.error(
                            "Music pause failed:",
                            error,
                        );

                        socket.emit(
                            "music:playback-error",
                            {
                                message:
                                    "Unable to pause playback",
                            },
                        );
                    }
                },
            );

            // ---------------------------------------------------------
            // MUSIC SEEK
            // ---------------------------------------------------------

            socket.on(
                "music:seek",
                (payload) => {
                    try {
                        const result =
                            getParticipantBySocketId(
                                socket.id,
                            );

                        if (!result) {
                            socket.emit(
                                "music:playback-error",
                                {
                                    message:
                                        "You are not in a room",
                                },
                            );

                            return;
                        }

                        const {
                            room,
                            participant,
                        } = result;

                        if (
                            room.type !==
                            "music"
                        ) {
                            socket.emit(
                                "music:playback-error",
                                {
                                    message:
                                        "Playback is only available in music rooms",
                                },
                            );

                            return;
                        }

                        if (
                            !participant.isHost
                        ) {
                            socket.emit(
                                "music:playback-error",
                                {
                                    message:
                                        "Only the host can control playback",
                                },
                            );

                            return;
                        }

                        const position =
                            payload?.position;

                        if (
                            typeof position !==
                            "number" ||
                            !Number.isFinite(
                                position,
                            ) ||
                            position < 0
                        ) {
                            socket.emit(
                                "music:playback-error",
                                {
                                    message:
                                        "Invalid playback position",
                                },
                            );

                            return;
                        }

                        const currentIndex =
                            room.playback
                                .currentIndex;

                        const currentMedia =
                            currentIndex !==
                                null
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

                        room.playback =
                        {
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
                        );
                    } catch (error) {
                        console.error(
                            "Music seek failed:",
                            error,
                        );

                        socket.emit(
                            "music:playback-error",
                            {
                                message:
                                    "Unable to seek playback",
                            },
                        );
                    }
                },
            );

            // ---------------------------------------------------------
            // MUSIC NEXT
            // ---------------------------------------------------------

            socket.on(
                "music:next",
                () => {
                    try {
                        const result =
                            getParticipantBySocketId(
                                socket.id,
                            );

                        if (!result) {
                            socket.emit(
                                "music:playback-error",
                                {
                                    message:
                                        "You are not in a room",
                                },
                            );

                            return;
                        }

                        const {
                            room,
                            participant,
                        } = result;

                        if (
                            room.type !==
                            "music"
                        ) {
                            socket.emit(
                                "music:playback-error",
                                {
                                    message:
                                        "Playback is only available in music rooms",
                                },
                            );

                            return;
                        }

                        if (
                            !participant.isHost
                        ) {
                            socket.emit(
                                "music:playback-error",
                                {
                                    message:
                                        "Only the host can control playback",
                                },
                            );

                            return;
                        }

                        const activeRoom =
                            getActiveRoom(
                                room.roomId,
                            );

                        if (
                            !activeRoom ||
                            activeRoom.queue
                                .length === 0
                        ) {
                            return;
                        }

                        const currentIndex =
                            activeRoom.playback
                                .currentIndex ??
                            0;

                        const next =
                            getNextIndex(
                                activeRoom.queue
                                    .length,
                                currentIndex,
                                activeRoom
                                    .playback
                                    .mode,
                                activeRoom
                                    .shuffleOrder,
                                activeRoom
                                    .shufflePosition,
                            );

                        activeRoom.shuffleOrder =
                            next.shuffleOrder;

                        activeRoom.shufflePosition =
                            next.shufflePosition;

                        if (
                            next.index === null
                        ) {
                            const currentMedia =
                                activeRoom.queue[
                                currentIndex
                                ];

                            activeRoom.playback =
                            {
                                ...activeRoom.playback,
                                mediaId:
                                    currentMedia.mediaId,
                                mediaType:
                                    "music",
                                position:
                                    currentMedia.duration ??
                                    0,
                                isPlaying:
                                    false,
                                updatedAt:
                                    Date.now(),
                                updatedBy:
                                    participant.participantId,
                                currentIndex:
                                    currentIndex,
                            };

                            emitPlayback(
                                io,
                                activeRoom,
                            );

                            return;
                        }

                        const nextMedia =
                            activeRoom.queue[
                            next.index
                            ];

                        activeRoom.playback =
                        {
                            ...activeRoom.playback,
                            mediaId:
                                nextMedia.mediaId,
                            mediaType:
                                "music",
                            position: 0,
                            isPlaying:
                                true,
                            updatedAt:
                                Date.now(),
                            updatedBy:
                                participant.participantId,
                            currentIndex:
                                next.index,
                        };

                        emitPlayback(
                            io,
                            activeRoom,
                        );
                    } catch (error) {
                        console.error(
                            "Music next failed:",
                            error,
                        );

                        socket.emit(
                            "music:playback-error",
                            {
                                message:
                                    "Unable to play next song",
                            },
                        );
                    }
                },
            );

            // ---------------------------------------------------------
            // MUSIC PREVIOUS
            // ---------------------------------------------------------

            socket.on(
                "music:previous",
                () => {
                    try {
                        const result =
                            getParticipantBySocketId(
                                socket.id,
                            );

                        if (!result) {
                            socket.emit(
                                "music:playback-error",
                                {
                                    message:
                                        "You are not in a room",
                                },
                            );

                            return;
                        }

                        const {
                            room,
                            participant,
                        } = result;

                        if (
                            room.type !==
                            "music"
                        ) {
                            socket.emit(
                                "music:playback-error",
                                {
                                    message:
                                        "Playback is only available in music rooms",
                                },
                            );

                            return;
                        }

                        if (
                            !participant.isHost
                        ) {
                            socket.emit(
                                "music:playback-error",
                                {
                                    message:
                                        "Only the host can control playback",
                                },
                            );

                            return;
                        }

                        const activeRoom =
                            getActiveRoom(
                                room.roomId,
                            );

                        if (
                            !activeRoom ||
                            activeRoom.queue
                                .length === 0
                        ) {
                            return;
                        }

                        const currentIndex =
                            activeRoom.playback
                                .currentIndex ??
                            0;

                        const previous =
                            getPreviousIndex(
                                activeRoom.queue
                                    .length,
                                currentIndex,
                                activeRoom
                                    .playback
                                    .mode,
                                activeRoom
                                    .shuffleOrder,
                                activeRoom
                                    .shufflePosition,
                            );

                        activeRoom.shuffleOrder =
                            previous.shuffleOrder;

                        activeRoom.shufflePosition =
                            previous.shufflePosition;

                        if (
                            previous.index ===
                            null
                        ) {
                            return;
                        }

                        const previousMedia =
                            activeRoom.queue[
                            previous.index
                            ];

                        activeRoom.playback =
                        {
                            ...activeRoom.playback,
                            mediaId:
                                previousMedia.mediaId,
                            mediaType:
                                "music",
                            position: 0,
                            isPlaying:
                                true,
                            updatedAt:
                                Date.now(),
                            updatedBy:
                                participant.participantId,
                            currentIndex:
                                previous.index,
                        };

                        emitPlayback(
                            io,
                            activeRoom,
                        );
                    } catch (error) {
                        console.error(
                            "Music previous failed:",
                            error,
                        );

                        socket.emit(
                            "music:playback-error",
                            {
                                message:
                                    "Unable to play previous song",
                            },
                        );
                    }
                },
            );

            // ---------------------------------------------------------
            // MUSIC PLAYBACK MODE
            // ---------------------------------------------------------

            socket.on(
                "music:set-mode",
                (payload) => {
                    try {
                        const mode =
                            payload?.mode;

                        if (
                            !VALID_PLAYBACK_MODES.includes(
                                mode,
                            )
                        ) {
                            socket.emit(
                                "music:playback-error",
                                {
                                    message:
                                        "Invalid playback mode",
                                },
                            );

                            return;
                        }

                        const result =
                            getParticipantBySocketId(
                                socket.id,
                            );

                        if (!result) {
                            socket.emit(
                                "music:playback-error",
                                {
                                    message:
                                        "You are not in a room",
                                },
                            );

                            return;
                        }

                        const {
                            room,
                            participant,
                        } = result;

                        if (
                            room.type !==
                            "music"
                        ) {
                            socket.emit(
                                "music:playback-error",
                                {
                                    message:
                                        "Playback is only available in music rooms",
                                },
                            );

                            return;
                        }

                        if (
                            !participant.isHost
                        ) {
                            socket.emit(
                                "music:playback-error",
                                {
                                    message:
                                        "Only the host can change playback mode",
                                },
                            );

                            return;
                        }

                        const activeRoom =
                            getActiveRoom(
                                room.roomId,
                            );

                        if (!activeRoom) {
                            return;
                        }

                        setPlaybackMode(
                            activeRoom.roomId,
                            mode,
                        );

                        if (
                            mode === "shuffle"
                        ) {
                            const currentIndex =
                                activeRoom.playback
                                    .currentIndex;

                            if (
                                currentIndex !==
                                null &&
                                activeRoom.queue
                                    .length > 0
                            ) {
                                const shuffle =
                                    createShuffleOrder(
                                        activeRoom
                                            .queue
                                            .length,
                                        currentIndex,
                                    );

                                activeRoom.shuffleOrder =
                                    shuffle.order;

                                activeRoom.shufflePosition =
                                    shuffle.position;
                            } else {
                                activeRoom.shuffleOrder =
                                    [];
                                activeRoom.shufflePosition =
                                    0;
                            }
                        } else {
                            activeRoom.shuffleOrder =
                                [];
                            activeRoom.shufflePosition =
                                0;
                        }

                        activeRoom.playback =
                        {
                            ...activeRoom.playback,
                            mode,
                            updatedAt:
                                Date.now(),
                            updatedBy:
                                participant.participantId,
                        };

                        emitPlayback(
                            io,
                            activeRoom,
                        );
                    } catch (error) {
                        console.error(
                            "Music mode change failed:",
                            error,
                        );

                        socket.emit(
                            "music:playback-error",
                            {
                                message:
                                    "Unable to change playback mode",
                            },
                        );
                    }
                },
            );

            // ---------------------------------------------------------
            // MUSIC ENDED
            // ---------------------------------------------------------

            socket.on(
                "music:ended",
                () => {
                    try {
                        const result =
                            getParticipantBySocketId(
                                socket.id,
                            );

                        if (!result) {
                            return;
                        }

                        const {
                            room,
                            participant,
                        } = result;

                        if (
                            room.type !==
                            "music"
                        ) {
                            return;
                        }

                        if (
                            !participant.isHost
                        ) {
                            return;
                        }

                        const activeRoom =
                            getActiveRoom(
                                room.roomId,
                            );

                        if (
                            !activeRoom ||
                            activeRoom.queue
                                .length === 0
                        ) {
                            return;
                        }

                        const currentIndex =
                            activeRoom.playback
                                .currentIndex;

                        if (
                            currentIndex ===
                            null
                        ) {
                            return;
                        }

                        // -------------------------------------------------
                        // REPEAT ONE
                        // -------------------------------------------------

                        if (
                            activeRoom.playback
                                .mode ===
                            "repeat_one"
                        ) {
                            const currentMedia =
                                activeRoom.queue[
                                currentIndex
                                ];

                            if (!currentMedia) {
                                return;
                            }

                            activeRoom.playback =
                            {
                                ...activeRoom.playback,
                                mediaId:
                                    currentMedia.mediaId,
                                mediaType:
                                    "music",
                                position: 0,
                                isPlaying:
                                    true,
                                updatedAt:
                                    Date.now(),
                                updatedBy:
                                    participant.participantId,
                                currentIndex:
                                    currentIndex,
                            };

                            emitPlayback(
                                io,
                                activeRoom,
                            );

                            return;
                        }

                        const next =
                            getNextIndex(
                                activeRoom.queue
                                    .length,
                                currentIndex,
                                activeRoom
                                    .playback
                                    .mode,
                                activeRoom
                                    .shuffleOrder,
                                activeRoom
                                    .shufflePosition,
                            );

                        activeRoom.shuffleOrder =
                            next.shuffleOrder;

                        activeRoom.shufflePosition =
                            next.shufflePosition;

                        // -------------------------------------------------
                        // QUEUE FINISHED
                        // -------------------------------------------------

                        if (
                            next.index === null
                        ) {
                            const currentMedia =
                                activeRoom.queue[
                                currentIndex
                                ];

                            if (!currentMedia) {
                                return;
                            }

                            activeRoom.playback =
                            {
                                ...activeRoom.playback,
                                mediaId:
                                    currentMedia.mediaId,
                                mediaType:
                                    "music",
                                position:
                                    currentMedia.duration ??
                                    0,
                                isPlaying:
                                    false,
                                updatedAt:
                                    Date.now(),
                                updatedBy:
                                    participant.participantId,
                                currentIndex:
                                    currentIndex,
                            };

                            emitPlayback(
                                io,
                                activeRoom,
                            );

                            return;
                        }

                        const nextMedia =
                            activeRoom.queue[
                            next.index
                            ];

                        if (!nextMedia) {
                            return;
                        }

                        activeRoom.playback =
                        {
                            ...activeRoom.playback,
                            mediaId:
                                nextMedia.mediaId,
                            mediaType:
                                "music",
                            position: 0,
                            isPlaying:
                                true,
                            updatedAt:
                                Date.now(),
                            updatedBy:
                                participant.participantId,
                            currentIndex:
                                next.index,
                        };

                        emitPlayback(
                            io,
                            activeRoom,
                        );
                    } catch (error) {
                        console.error(
                            "Music ended handling failed:",
                            error,
                        );

                        socket.emit(
                            "music:playback-error",
                            {
                                message:
                                    "Unable to play next song",
                            },
                        );
                    }
                },
            );

            // ---------------------------------------------------------
            // DISCONNECT
            // ---------------------------------------------------------

            socket.on(
                "disconnect",
                (reason) => {
                    console.log(
                        `Socket disconnected: ${socket.id} — ${reason}`,
                    );

                    const result =
                        getParticipantBySocketId(
                            socket.id,
                        );

                    if (!result) {
                        /*
                         * Expected when the participant has already reconnected
                         * with a newer socket.
                         */
                        return;
                    }

                    const {
                        room,
                        participant,
                    } = result;

                    scheduleParticipantDisconnect(
                        room.roomId,
                        participant.participantId,
                        ({
                            newHost,
                            roomRemoved,
                        }) => {
                            const activeRoom =
                                getActiveRoom(
                                    room.roomId,
                                );

                            /*
                             * Everybody has left. The in-memory room has already
                             * been removed, so there is nothing to broadcast.
                             */
                            if (
                                roomRemoved ||
                                !activeRoom
                            ) {
                                return;
                            }

                            /*
                             * The participant actually left after the grace period.
                             * Broadcast the new participant list. If the removed
                             * participant was host, transferHost() has already run
                             * inside room-store.
                             */
                            emitParticipants(
                                io,
                                activeRoom,
                            );

                            /*
                             * newHost is intentionally available here for future
                             * host-specific events/notifications.
                             */
                            if (newHost) {
                                console.log(
                                    `Host transferred in room ${room.code}: ${newHost.participantId}`,
                                );
                            }
                        },
                    );
                },
            );
        },
    );
}