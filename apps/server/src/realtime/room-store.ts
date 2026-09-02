import type {
  ActiveRoom,
  ActiveParticipant,
  PlaybackMode,
} from "@syncspace/shared";

const activeRooms = new Map<string, ActiveRoom>();

/*
 * Keep a disconnected participant in the live room briefly so that
 * normal Socket.IO reconnects can restore the same participant,
 * seat and host status.
 */
const DISCONNECT_GRACE_PERIOD_MS = 15_000;

const pendingDisconnects = new Map<
  string,
  ReturnType<typeof setTimeout>
>();

export function getActiveRoom(roomId: string) {
  return activeRooms.get(roomId);
}

export function createActiveRoom(room: ActiveRoom) {
  const existingRoom = activeRooms.get(room.roomId);

  if (existingRoom) {
    return existingRoom;
  }

  activeRooms.set(room.roomId, room);

  return room;
}

export function removeActiveRoom(roomId: string) {
  cancelPendingDisconnectsForRoom(roomId);
  activeRooms.delete(roomId);
}

export function addParticipant(
  roomId: string,
  participant: ActiveParticipant,
) {
  const room = activeRooms.get(roomId);

  if (!room) {
    return null;
  }

  /*
   * A participant reconnecting with the same participantId
   * replaces the old socketId while preserving their existing
   * seat and host status.
   */
  const existingParticipant =
    room.participants.get(
      participant.participantId,
    );

  if (existingParticipant) {
    const updatedParticipant: ActiveParticipant = {
      ...existingParticipant,
      ...participant,
      seat:
        existingParticipant.seat ??
        participant.seat,
      isHost:
        existingParticipant.isHost ||
        participant.isHost,
    };

    room.participants.set(
      participant.participantId,
      updatedParticipant,
    );

    cancelPendingDisconnect(
      roomId,
      participant.participantId,
    );

    return updatedParticipant;
  }

  room.participants.set(
    participant.participantId,
    participant,
  );

  return participant;
}

export function scheduleParticipantDisconnect(
  roomId: string,
  participantId: string,
  onRemoved?: (
    result: {
      participant: ActiveParticipant;
      newHost: ActiveParticipant | null;
      roomRemoved: boolean;
    },
  ) => void,
) {
  const room = activeRooms.get(roomId);

  if (!room) {
    return null;
  }

  const participant =
    room.participants.get(
      participantId,
    );

  if (!participant) {
    return null;
  }

  cancelPendingDisconnect(
    roomId,
    participantId,
  );

  const key =
    getDisconnectKey(
      roomId,
      participantId,
    );

  const timer = setTimeout(() => {
    pendingDisconnects.delete(key);

    const currentRoom =
      activeRooms.get(roomId);

    if (!currentRoom) {
      return;
    }

    const currentParticipant =
      currentRoom.participants.get(
        participantId,
      );

    if (!currentParticipant) {
      return;
    }

    /*
     * Permanently remove the participant after the reconnect
     * grace period.
     */
    const wasHost =
      currentParticipant.isHost;

    currentRoom.participants.delete(
      participantId,
    );

    /*
     * If the removed participant was the host, immediately
     * transfer host responsibility to another active participant.
     */
    let newHost: ActiveParticipant | null =
      null;

    if (
      wasHost &&
      currentRoom.participants.size > 0
    ) {
      newHost =
        transferHost(roomId);
    }

    const roomRemoved =
      currentRoom.participants.size ===
      0;

    if (roomRemoved) {
      removeActiveRoom(roomId);
    }

    onRemoved?.({
      participant:
        currentParticipant,
      newHost,
      roomRemoved,
    });
  }, DISCONNECT_GRACE_PERIOD_MS);

  pendingDisconnects.set(
    key,
    timer,
  );

  return timer;
}

export function cancelPendingDisconnect(
  roomId: string,
  participantId: string,
) {
  const key =
    getDisconnectKey(
      roomId,
      participantId,
    );

  const timer =
    pendingDisconnects.get(key);

  if (!timer) {
    return;
  }

  clearTimeout(timer);
  pendingDisconnects.delete(key);
}

function getDisconnectKey(
  roomId: string,
  participantId: string,
) {
  return `${roomId}:${participantId}`;
}

function cancelPendingDisconnectsForRoom(
  roomId: string,
) {
  const prefix = `${roomId}:`;

  for (const [
    key,
    timer,
  ] of pendingDisconnects.entries()) {
    if (!key.startsWith(prefix)) {
      continue;
    }

    clearTimeout(timer);
    pendingDisconnects.delete(key);
  }
}

export function removeParticipant(
  roomId: string,
  participantId: string,
) {
  const room = activeRooms.get(roomId);

  if (!room) {
    return null;
  }

  cancelPendingDisconnect(
    roomId,
    participantId,
  );

  const participant =
    room.participants.get(
      participantId,
    );

  if (!participant) {
    return null;
  }

  const wasHost =
    participant.isHost;

  room.participants.delete(
    participantId,
  );

  /*
   * If the host is removed through any non-grace-period path,
   * make sure another participant becomes host.
   */
  if (
    wasHost &&
    room.participants.size > 0
  ) {
    transferHost(roomId);
  }

  /*
   * The live room can safely disappear once everybody has actually
   * left.
   */
  if (room.participants.size === 0) {
    removeActiveRoom(roomId);
  }

  return participant;
}

export function getParticipantBySocketId(
  socketId: string,
) {
  for (const room of activeRooms.values()) {
    for (const participant of room.participants.values()) {
      if (
        participant.socketId ===
        socketId
      ) {
        return {
          room,
          participant,
        };
      }
    }
  }

  return null;
}

export function transferHost(
  roomId: string,
) {
  const room = activeRooms.get(roomId);

  if (
    !room ||
    room.participants.size === 0
  ) {
    return null;
  }

  const nextHost =
    room.participants.values().next()
      .value;

  if (!nextHost) {
    return null;
  }

  for (const participant of room.participants.values()) {
    participant.isHost =
      participant.participantId ===
      nextHost.participantId;
  }

  return nextHost;
}

export function assignNextAvailableSeat(
  roomId: string,
  participantId: string,
) {
  const room = activeRooms.get(roomId);

  if (!room) {
    return null;
  }

  const participant =
    room.participants.get(
      participantId,
    );

  if (!participant) {
    return null;
  }

  if (participant.seat !== null) {
    return participant.seat;
  }

  const occupiedSeats =
    new Set<number>();

  for (const member of room.participants.values()) {
    if (member.seat !== null) {
      occupiedSeats.add(
        member.seat,
      );
    }
  }

  for (
    let seat = 1;
    seat <= room.maxSeats;
    seat++
  ) {
    if (
      !occupiedSeats.has(seat)
    ) {
      participant.seat = seat;

      return seat;
    }
  }

  return null;
}

export function changeParticipantSeat(
  roomId: string,
  participantId: string,
  requestedSeat: number,
) {
  const room = activeRooms.get(roomId);

  if (!room) {
    return {
      success: false,
      error: "Room not found",
    };
  }

  const participant =
    room.participants.get(
      participantId,
    );

  if (!participant) {
    return {
      success: false,
      error: "Participant not found",
    };
  }

  if (
    !Number.isInteger(requestedSeat) ||
    requestedSeat < 1 ||
    requestedSeat > room.maxSeats
  ) {
    return {
      success: false,
      error: "Invalid seat",
    };
  }

  const occupant =
    Array.from(
      room.participants.values(),
    ).find(
      (member) =>
        member.seat ===
          requestedSeat &&
        member.participantId !==
          participantId,
    );

  if (occupant) {
    return {
      success: false,
      error: "Seat is already occupied",
    };
  }

  participant.seat =
    requestedSeat;

  return {
    success: true,
    participant,
  };
}

export function setPlaybackMode(
  roomId: string,
  mode: PlaybackMode,
) {
  const room = activeRooms.get(roomId);

  if (!room) {
    return null;
  }

  room.playback.mode = mode;

  return room;
}

export function shuffleArray(
  values: number[],
) {
  const result = [...values];

  for (
    let i = result.length - 1;
    i > 0;
    i--
  ) {
    const j =
      Math.floor(
        Math.random() *
          (i + 1),
      );

    [
      result[i],
      result[j],
    ] = [
      result[j],
      result[i],
    ];
  }

  return result;
}

/*
 * The database remains authoritative for persistent room expiry.
 *
 * ActiveRoom currently does not contain expiresAt, so expiry cannot
 * be safely calculated from in-memory state alone. Expiry is checked
 * against PostgreSQL during room join.
 */
export function cleanupExpiredActiveRooms(
  _now = Date.now(),
) {
  return [];
}