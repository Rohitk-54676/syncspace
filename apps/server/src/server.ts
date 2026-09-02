import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import http from "node:http";
import { Server } from "socket.io";

import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@syncspace/shared";

import { prisma } from "./lib/prisma";
import guestRouter from "./routes/guest";
import roomsRouter from "./routes/rooms";
import { registerSocketHandlers } from "./realtime/socket";
import youtubeRouter from "./routes/youtube";

const PORT = Number(process.env.PORT ?? 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:3000";

if (!Number.isInteger(PORT) || PORT <= 0 || PORT > 65535) {
  throw new Error(`Invalid PORT configuration: ${process.env.PORT}`);
}

const allowedOrigins = CORS_ORIGIN
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin: allowedOrigins,
  }),
);

app.use(
  express.json({
    limit: "100kb",
  }),
);

app.use("/api/guest", guestRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/youtube", youtubeRouter);

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      ok: true,
      service: "syncspace-server",
      database: "connected",
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    res.status(503).json({
      ok: false,
      service: "syncspace-server",
      database: "disconnected",
    });
  }
});

const httpServer = http.createServer(app);

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents
>(httpServer, {
  cors: {
    origin: allowedOrigins,
  },
});

registerSocketHandlers(io);

io.engine.on("connection_error", (error) => {
  console.error("Socket.IO connection error:", {
    message: error.message,
    code: error.code,
    context: error.context,
  });
});

const shutdown = async (signal: string) => {
  console.log(`${signal} received. Shutting down SyncSpace server...`);

  io.close();

  httpServer.close(async () => {
    try {
      await prisma.$disconnect();

      console.log("SyncSpace server shut down cleanly.");

      process.exit(0);
    } catch (error) {
      console.error("Error while disconnecting Prisma:", error);

      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10_000).unref();
};

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

httpServer.listen(PORT, () => {
  console.log(`SyncSpace server running on port ${PORT}`);
  console.log(`Allowed CORS origins: ${allowedOrigins.join(", ")}`);
});