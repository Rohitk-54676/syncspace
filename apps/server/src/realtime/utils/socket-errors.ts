import type { Server, Socket } from "socket.io";

import type {
    ClientToServerEvents,
    ServerToClientEvents,
} from "@syncspace/shared";

import {
    getParticipantBySocketId,
    scheduleParticipantDisconnect,
} from "../room-store";

type SocketServer = Server<
    ClientToServerEvents,
    ServerToClientEvents
>;

type SocketConnection = Socket<
    ClientToServerEvents,
    ServerToClientEvents
>;

export function registerDisconnectHandlers(
    io: SocketServer,
    socket: SocketConnection,
) {
    socket.on("disconnect", () => {
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

            scheduleParticipantDisconnect(
                room.roomId,
                participant.participantId,
                () => {
                    const activeRoom =
                        getParticipantBySocketId(
                            socket.id,
                        )?.room;

                    if (!activeRoom) {
                        return;
                    }

                    io.to(
                        activeRoom.code,
                    ).emit(
                        "room:participants",
                        {
                            participants:
                                Array.from(
                                    activeRoom
                                        .participants
                                        .values(),
                                ),
                        },
                    );
                },
            );
        } catch (error) {
            console.error(
                "Socket disconnect handling failed:",
                error,
            );
        }
    });
}