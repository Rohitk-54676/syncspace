import { Router } from "express";
import { generateParticipantId } from "../utils/participant";

const router = Router();

const MAX_DISPLAY_NAME_LENGTH = 30;

function isValidDisplayName(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const displayName = value.trim();

  if (!displayName) {
    return false;
  }

  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return false;
  }

  // Reject ASCII control characters.
  if (/[\u0000-\u001F\u007F]/.test(displayName)) {
    return false;
  }

  return true;
}

router.post("/identity", (req, res) => {
  const rawDisplayName = req.body?.displayName;

  if (!isValidDisplayName(rawDisplayName)) {
    res.status(400).json({
      error:
        "Display name is required, must be 30 characters or fewer, and cannot contain control characters",
    });

    return;
  }

  const displayName = rawDisplayName.trim();
  const participantId = generateParticipantId();

  res.status(201).json({
    participantId,
    displayName,
  });
});

export default router;