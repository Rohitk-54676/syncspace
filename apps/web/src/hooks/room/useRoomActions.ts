"use client";

import type {
    ChatMessage,
    MediaItem,
    PlaybackMode,
} from "@syncspace/shared";

import { socket } from "@/lib/socket";

interface RoomActionContext {
    roomType: "music" | "video";
    participantId: string | null;
}

export function useRoomActions({
    roomType,
    participantId,
}: RoomActionContext) {
    function changeSeat(seat: number) {
        if (!participantId) {
            return;
        }

        socket.emit("room:seat-change", {
            participantId,
            seat,
        });
    }

    function addToQueue(media: MediaItem) {
        if (roomType === "video") {
            socket.emit("video:queue-add", {
                media: {
                    ...media,
                    mediaType: "video",
                },
            });

            return;
        }

        socket.emit("music:queue-add", {
            media,
        });
    }

    function playVideo() {
        socket.emit("video:play");
    }

    function pauseVideo() {
        socket.emit("video:pause");
    }

    function seekVideo(position: number) {
        socket.emit("video:seek", {
            position,
        });
    }

    function endVideo() {
        socket.emit("video:ended");
    }

    function nextVideo() {
        socket.emit("video:next");
    }

    function previousVideo() {
        socket.emit("video:previous");
    }

    function setVideoMode(mode: PlaybackMode) {
        socket.emit("video:set-mode", {
            mode,
        });
    }

    function sendChatMessage(message: string) {
        const trimmedMessage =
            message.trim();

        if (!trimmedMessage) {
            return;
        }

        socket.emit("chat:send", {
            message: trimmedMessage,
        });
    }

    return {
        changeSeat,
        addToQueue,

        playVideo,
        pauseVideo,
        seekVideo,
        endVideo,
        nextVideo,
        previousVideo,
        setVideoMode,

        sendChatMessage,
    };
}