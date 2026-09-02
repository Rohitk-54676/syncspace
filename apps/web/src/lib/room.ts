import type { Room } from "@syncspace/shared";

const ROOM_KEY = "syncspace:room";

function isValidRoom(
  value: unknown,
): value is Room {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const candidate =
    value as Record<string, unknown>;

  const validType =
    candidate.type === "music" ||
    candidate.type === "video";

  const validMaxSeats =
    typeof candidate.maxSeats ===
      "number" &&
    Number.isInteger(
      candidate.maxSeats,
    ) &&
    candidate.maxSeats >= 6 &&
    candidate.maxSeats <= 10;

  const validDates =
    typeof candidate.createdAt ===
      "string" &&
    typeof candidate.expiresAt ===
      "string" &&
    !Number.isNaN(
      Date.parse(
        candidate.createdAt,
      ),
    ) &&
    !Number.isNaN(
      Date.parse(
        candidate.expiresAt,
      ),
    );

  return (
    typeof candidate.id ===
      "string" &&
    candidate.id.trim()
      .length > 0 &&
    typeof candidate.code ===
      "string" &&
    candidate.code.trim()
      .length > 0 &&
    validType &&
    validMaxSeats &&
    validDates
  );
}

export function saveRoom(
  room: Room,
) {
  if (!isValidRoom(room)) {
    throw new Error(
      "Invalid room data",
    );
  }

  sessionStorage.setItem(
    ROOM_KEY,
    JSON.stringify({
      ...room,
      code:
        room.code.trim().toUpperCase(),
    }),
  );
}

export function getRoom():
  | Room
  | null {
  const stored =
    sessionStorage.getItem(
      ROOM_KEY,
    );

  if (!stored) {
    return null;
  }

  try {
    const parsed: unknown =
      JSON.parse(stored);

    if (!isValidRoom(parsed)) {
      sessionStorage.removeItem(
        ROOM_KEY,
      );

      return null;
    }

    return {
      ...parsed,
      code:
        parsed.code.trim().toUpperCase(),
    };
  } catch {
    sessionStorage.removeItem(
      ROOM_KEY,
    );

    return null;
  }
}

export function clearRoom() {
  sessionStorage.removeItem(
    ROOM_KEY,
  );
}