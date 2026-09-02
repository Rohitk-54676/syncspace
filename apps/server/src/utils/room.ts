import { randomInt } from "node:crypto";

const ROOM_CODE_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;

export function generateRoomCode(): string {
  let code = "";

  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARACTERS[
      randomInt(ROOM_CODE_CHARACTERS.length)
    ];
  }

  return code;
}