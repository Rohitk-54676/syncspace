import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import http from "node:http";
import { Server } from "socket.io";
import { prisma } from "./lib/prisma";

const PORT = Number(process.env.PORT ?? 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:3000";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: CORS_ORIGIN,
  }),
);

app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
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

const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
  },
});

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("disconnect", (reason) => {
    console.log(`Socket disconnected: ${socket.id} — ${reason}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`SyncSpace server running on http://localhost:${PORT}`);
});