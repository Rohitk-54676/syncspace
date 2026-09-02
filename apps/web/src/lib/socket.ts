import {
  io,
  type Socket,
} from "socket.io-client";

import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "@syncspace/shared";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ??
  "http://localhost:4000";

export const socket: Socket<
  ServerToClientEvents,
  ClientToServerEvents
> = io(SOCKET_URL, {
  autoConnect: false,

  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,

  timeout: 10_000,
});