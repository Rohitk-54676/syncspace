import type { Server, Socket } from "socket.io";

import type {
    ClientToServerEvents,
    ServerToClientEvents,
} from "@syncspace/shared";

import { prisma } from "../../lib/prisma";
import {
    addParticipant,
    assignNextAvailableSeat,
    cancelPendingDisconnect,
    createActiveRoom,
    getActiveRoom,
} from "../room-store";
import {
    getCurrentPlaybackPosition,
} from "../media/media-playback";

const MAX_DISPLAY_NAME_LENGTH = 30;

type SocketServer = Server<
    ClientToServerEvents,
    ServerToClientEvents
>;

type SocketConnection = Socket<
    ClientToServerEvents,
    ServerToClientEvents
>;

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
    io: SocketServer,
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

export function registerRoomHandlers(
    io: SocketServer,
    socket: SocketConnection,
) {
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

                if (!persistent.room) {
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
                        room.type === "MUSIC"
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
                            shuffleOrder: [],
                            shufflePosition: 0,
                            createdAt:
                                room.createdAt.getTime(),
                        });
                }

                const existingParticipant =
                    activeRoom.participants.get(
                        participantId,
                    );

                /*
                 * Cancel a pending disconnect before
                 * checking capacity.
                 *
                 * This lets a reconnect reclaim
                 * its original seat.
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
                 * If this participant already has
                 * another socket, the new connection
                 * replaces the old socket.
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

                /*
                 * Refresh the participant after seat assignment
                 * so room:joined contains the assigned seat.
                 */
                const updatedParticipant =
                    getActiveRoom(room.id)
                        ?.participants.get(
                            participant.participantId,
                        ) ?? participant;

                socket.join(
                    room.code,
                );

                socket.emit(
                    "room:joined",
                    {
                        room: {
                            id: room.id,
                            code: room.code,
                            type:
                                room.type ===
                                "MUSIC"
                                    ? "music"
                                    : "video",
                            maxSeats:
                                room.maxSeats,
                        },
                        participant:
                            updatedParticipant,
                    },
                );

                /*
                 * Send the current media state only to the
                 * participant who just joined.
                 *
                 * This is important for late joins and reconnects:
                 * the new participant immediately receives the
                 * existing queue and authoritative playback state.
                 */
                if (
                    activeRoom.type ===
                    "music"
                ) {
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
                } else {
                    socket.emit(
                        "video:queue-updated",
                        {
                            queue:
                                activeRoom.queue,
                        },
                    );

                    socket.emit(
                        "video:playback-updated",
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
                }

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
}