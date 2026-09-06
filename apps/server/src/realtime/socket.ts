import type { Server } from "socket.io";

import type {
    ClientToServerEvents,
    ServerToClientEvents,
} from "@syncspace/shared";

import { registerRoomHandlers } from "./handlers/room-handlers";
import { registerSeatHandlers } from "./handlers/seat-handlers";
import { registerChatHandlers } from "./handlers/chat-handlers";
import { registerMediaHandlers } from "./handlers/media-handlers";
import { registerDisconnectHandlers } from "./handlers/disconnect-handlers";

type SocketServer = Server<
    ClientToServerEvents,
    ServerToClientEvents
>;

export function registerSocketHandlers(
    io: SocketServer,
) {
    io.on(
        "connection",
        (socket) => {
            console.log(
                `Socket connected: ${socket.id}`,
            );

            /*
             * Room lifecycle
             *
             * Handles:
             * - room:join
             * - initial room/media state
             * - reconnect handling
             */
            registerRoomHandlers(
                io,
                socket,
            );

            /*
             * Seat management
             *
             * Handles:
             * - room:seat-change
             */
            registerSeatHandlers(
                io,
                socket,
            );

            /*
             * Chat
             *
             * Handles:
             * - chat:send
             */
            registerChatHandlers(
                io,
                socket,
            );

            /*
             * Shared Music + Video media controls
             *
             * Handles:
             * - music:*
             * - video:*
             */
            registerMediaHandlers(
                io,
                socket,
            );

            /*
             * Disconnect / reconnect grace-period handling
             */
            registerDisconnectHandlers(
                io,
                socket,
            );
        },
    );
}