const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface ApiRoom {
  id: string;
  code: string;
  type: "music" | "video";
  maxSeats: number;
  createdAt: string;
  expiresAt: string;
}

export interface GuestIdentityResponse {
  participantId: string;
  displayName: string;
}

export interface RoomResponse {
  room: ApiRoom;
}

async function parseResponse<T>(
  response: Response,
): Promise<T> {
  let data: unknown = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
    ) {
      throw new Error(data.error);
    }

    throw new Error(
      `Request failed with status ${response.status}`,
    );
  }

  return data as T;
}

export async function createGuestIdentity(
  displayName: string,
): Promise<GuestIdentityResponse> {
  const response = await fetch(
    `${API_URL}/api/guest/identity`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        displayName,
      }),
    },
  );

  return parseResponse<GuestIdentityResponse>(
    response,
  );
}

export async function createRoom(
  type: "music" | "video",
  maxSeats: number,
): Promise<RoomResponse> {
  const response = await fetch(
    `${API_URL}/api/rooms`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type,
        maxSeats,
      }),
    },
  );

  return parseResponse<RoomResponse>(
    response,
  );
}

export async function joinRoom(
  code: string,
): Promise<RoomResponse> {
  const response = await fetch(
    `${API_URL}/api/rooms/join`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: code.trim().toUpperCase(),
      }),
    },
  );

  return parseResponse<RoomResponse>(
    response,
  );
}