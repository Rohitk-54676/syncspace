import type { ParticipantIdentity } from "@syncspace/shared";

const GUEST_IDENTITY_KEY = "syncspace:guest";

function isValidGuestIdentity(
  value: unknown,
): value is ParticipantIdentity {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const candidate =
    value as Record<string, unknown>;

  return (
    typeof candidate.participantId ===
      "string" &&
    candidate.participantId.trim()
      .length > 0 &&
    typeof candidate.displayName ===
      "string" &&
    candidate.displayName.trim()
      .length > 0 &&
    candidate.displayName.trim()
      .length <= 30
  );
}

export function saveGuestIdentity(
  identity: ParticipantIdentity,
) {
  if (
    !isValidGuestIdentity(identity)
  ) {
    throw new Error(
      "Invalid guest identity",
    );
  }

  sessionStorage.setItem(
    GUEST_IDENTITY_KEY,
    JSON.stringify({
      participantId:
        identity.participantId.trim(),
      displayName:
        identity.displayName.trim(),
    }),
  );
}

export function getGuestIdentity():
  | ParticipantIdentity
  | null {
  const stored =
    sessionStorage.getItem(
      GUEST_IDENTITY_KEY,
    );

  if (!stored) {
    return null;
  }

  try {
    const parsed: unknown =
      JSON.parse(stored);

    if (
      !isValidGuestIdentity(parsed)
    ) {
      sessionStorage.removeItem(
        GUEST_IDENTITY_KEY,
      );

      return null;
    }

    return {
      participantId:
        parsed.participantId.trim(),
      displayName:
        parsed.displayName.trim(),
    };
  } catch {
    sessionStorage.removeItem(
      GUEST_IDENTITY_KEY,
    );

    return null;
  }
}

export function clearGuestIdentity() {
  sessionStorage.removeItem(
    GUEST_IDENTITY_KEY,
  );
}