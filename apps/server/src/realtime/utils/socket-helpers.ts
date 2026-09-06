import type { Server, Socket } from "socket.io";

import type {
    ActiveParticipant,
    ClientToServerEvents,
    ServerToClientEvents,
} from "@syncspace/shared";

import {
    getActiveRoom,
    getParticipantBySocketId,
} from "../room-store";

export type SocketServer = Server<
    ClientToServerEvents,
    ServerToClientEvents
>;

export type SocketConnection = Socket<
    ClientToServerEvents,
    ServerToClientEvents
>;

export function getSocketRoomContext(
    socket: SocketConnection,
) {
    const result =
        getParticipantBySocketId(
            socket.id,
        );

    if (!result) {
        return null;
    }

    const activeRoom =
        getActiveRoom(
            result.room.roomId,
        );

    if (!activeRoom) {
        return null;
    }

    return {
        room: activeRoom,
        participant:
            result.participant,
    };
}

export function isHost(
    socket: SocketConnection,
): boolean {
    const context =
        getSocketRoomContext(socket);

    return (
        context?.participant.isHost ??
        false
    );
}

export function emitParticipants(
    io: SocketServer,
    room: {
        code: string;
        participants: Map<
            string,
            ActiveParticipant
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