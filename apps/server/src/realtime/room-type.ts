import type { RoomType } from "@syncspace/shared";

export function isVideoRoom(
    roomType: RoomType,
): boolean {
    return roomType === "video";
}

export function isMusicRoom(
    roomType: RoomType,
): boolean {
    return roomType === "music";
}