import type { Server, Socket } from "socket.io";

import type {
    ClientToServerEvents,
    ServerToClientEvents,
} from "@syncspace/shared";

import {
    changeParticipantSeat,
    getActiveRoom,
    getParticipantBySocketId,
} from "../room-store";

type SocketServer = Server<
    ClientToServerEvents,
    ServerToClientEvents
>;

type SocketConnection = Socket<
    ClientToServerEvents,
    ServerToClientEvents
>;

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

export function registerSeatHandlers(
    io: SocketServer,
    socket: SocketConnection,
) {
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
                    !Number.isInteger(seat)
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
}