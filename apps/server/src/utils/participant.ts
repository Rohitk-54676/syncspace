import { randomUUID } from "node:crypto";

export function generateParticipantId(): string {
  return randomUUID();
}