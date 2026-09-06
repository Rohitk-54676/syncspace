import { randomUUID } from "node:crypto";
import type { Server, Socket } from "socket.io";

import type {
    ClientToServerEvents,
    ServerToClientEvents,
} from "@syncspace/shared";

import {
    getParticipantBySocketId,
} from "../room-store";

const MAX_CHAT_MESSAGE_LENGTH = 500;

type SocketServer = Server<
    ClientToServerEvents,
    ServerToClientEvents
>;

type SocketConnection = Socket<
    ClientToServerEvents,
    ServerToClientEvents
>;

export function registerChatHandlers(
    io: SocketServer,
    socket: SocketConnection,
) {
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
                    "Chat send failed:",
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
}