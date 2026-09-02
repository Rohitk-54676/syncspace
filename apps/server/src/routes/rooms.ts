import { Router } from "express";
import { prisma } from "../lib/prisma";
import { generateRoomCode } from "../utils/room";

const router = Router();

const MIN_SEATS = 6;
const MAX_SEATS = 10;
const ROOM_DURATION_MS = 2 * 60 * 60 * 1000;
const ROOM_CODE_GENERATION_ATTEMPTS = 5;

function formatRoom(room: {
  id: string;
  code: string;
  type: "MUSIC" | "VIDEO";
  maxSeats: number;
  createdAt: Date;
  expiresAt: Date;
}) {
  return {
    id: room.id,
    code: room.code,
    type: room.type === "MUSIC" ? "music" : "video",
    maxSeats: room.maxSeats,
    createdAt: room.createdAt.toISOString(),
    expiresAt: room.expiresAt.toISOString(),
  };
}

function isValidRoomType(value: unknown): value is "music" | "video" {
  return value === "music" || value === "video";
}

function isValidMaxSeats(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_SEATS &&
    value <= MAX_SEATS
  );
}

router.post("/", async (req, res) => {
  const type = req.body?.type;
  const maxSeats = req.body?.maxSeats;

  if (!isValidRoomType(type)) {
    res.status(400).json({
      error: "Room type must be music or video",
    });

    return;
  }

  if (!isValidMaxSeats(maxSeats)) {
    res.status(400).json({
      error: `maxSeats must be an integer between ${MIN_SEATS} and ${MAX_SEATS}`,
    });

    return;
  }

  const expiresAt = new Date(Date.now() + ROOM_DURATION_MS);

  for (let attempt = 0; attempt < ROOM_CODE_GENERATION_ATTEMPTS; attempt++) {
    const code = generateRoomCode();

    try {
      const room = await prisma.room.create({
        data: {
          code,
          type: type === "music" ? "MUSIC" : "VIDEO",
          maxSeats,
          expiresAt,
        },
      });

      res.status(201).json({
        room: formatRoom(room),
      });

      return;
    } catch (error: unknown) {
      const prismaError = error as {
        code?: string;
      };

      // Prisma P2002 = unique constraint violation.
      // Retry because the random room code collided with an existing room.
      if (prismaError.code === "P2002") {
        continue;
      }

      console.error("Room creation failed:", error);

      res.status(500).json({
        error: "Failed to create room",
      });

      return;
    }
  }

  console.error("Unable to generate a unique room code.");

  res.status(503).json({
    error: "Unable to create room right now. Please try again.",
  });
});

router.post("/join", async (req, res) => {
  const code =
    typeof req.body?.code === "string"
      ? req.body.code.trim().toUpperCase()
      : "";

  if (!code) {
    res.status(400).json({
      error: "Room code is required",
    });

    return;
  }

  const room = await prisma.room.findUnique({
    where: {
      code,
    },
  });

  if (!room) {
    res.status(404).json({
      error: "Room not found",
    });

    return;
  }

  if (room.expiresAt.getTime() <= Date.now()) {
    res.status(410).json({
      error: "Room has expired",
    });

    return;
  }

  res.status(200).json({
    room: formatRoom(room),
  });
});

export default router;