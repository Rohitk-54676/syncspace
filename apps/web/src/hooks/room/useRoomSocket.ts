"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type {
    ActiveParticipant,
    ChatMessage,
    MediaItem,
    MediaPlaybackState,
} from "@syncspace/shared";

import { getGuestIdentity } from "@/lib/guest";
import { getRoom } from "@/lib/room";
import { socket } from "@/lib/socket";

interface RoomJoinedData {
    room: {
        id: string;
        code: string;
        type: "music" | "video";
        maxSeats: number;
    };
    participant: ActiveParticipant;
}

export function useRoomSocket(
    roomCode: string,
) {
    const router = useRouter();

    const [ready, setReady] =
        useState(false);

    const [room, setRoom] =
        useState<ReturnType<typeof getRoom>>(
            null,
        );

    const [participant, setParticipant] =
        useState<
            ReturnType<typeof getGuestIdentity>
        >(null);

    const [participants, setParticipants] =
        useState<ActiveParticipant[]>([]);

    const [messages, setMessages] =
        useState<ChatMessage[]>([]);

    const [queue, setQueue] =
        useState<MediaItem[]>([]);

    const [queueError, setQueueError] =
        useState("");

    const [playback, setPlayback] =
        useState<MediaPlaybackState | null>(
            null,
        );

    useEffect(() => {
        const storedRoom = getRoom();
        const storedParticipant =
            getGuestIdentity();

        if (
            !storedParticipant ||
            !storedRoom
        ) {
            router.replace("/");
            return;
        }

        const normalizedCode =
            roomCode.toUpperCase();

        if (
            storedRoom.code !==
            normalizedCode
        ) {
            router.replace("/");
            return;
        }

        const roomType =
            storedRoom.type;

        setRoom(storedRoom);
        setParticipant(
            storedParticipant,
        );

        function handleRoomJoined(
            data: RoomJoinedData,
        ) {
            console.log(
                "Realtime room joined:",
                data,
            );

            setParticipant((current) => {
                if (!current) {
                    return current;
                }

                return {
                    participantId:
                        data.participant
                            .participantId,
                    displayName:
                        data.participant
                            .displayName,
                };
            });

            setReady(true);
        }

        function handleRoomError(data: {
            message: string;
        }) {
            console.error(
                "Realtime room error:",
                data.message,
            );

            setReady(false);
        }

        function handleConnect() {
            const currentRoom =
                getRoom();

            const currentParticipant =
                getGuestIdentity();

            if (
                !currentRoom ||
                !currentParticipant
            ) {
                router.replace("/");
                return;
            }

            console.log(
                "Socket connected:",
                socket.id,
            );

            socket.emit("room:join", {
                roomId:
                    currentRoom.id,
                participantId:
                    currentParticipant.participantId,
                displayName:
                    currentParticipant.displayName,
            });
        }

        function handleDisconnect(
            reason: string,
        ) {
            console.log(
                "Socket disconnected:",
                reason,
            );
        }

        function handleParticipants(
            data: {
                participants: ActiveParticipant[];
            },
        ) {
            setParticipants(
                data.participants,
            );
        }

        function handleSeatError(
            data: {
                message: string;
            },
        ) {
            console.error(
                "Seat change failed:",
                data.message,
            );
        }

        function handleChatMessage(
            message: ChatMessage,
        ) {
            setMessages((current) => [
                ...current,
                message,
            ]);
        }

        function handleChatError(
            data: {
                message: string;
            },
        ) {
            console.error(
                "Chat error:",
                data.message,
            );
        }

        function handleMusicQueueUpdated(
            data: {
                queue: MediaItem[];
            },
        ) {
            if (roomType !== "music") {
                return;
            }

            setQueue(data.queue);
            setQueueError("");
        }

        function handleMusicQueueError(
            data: {
                message: string;
            },
        ) {
            if (roomType !== "music") {
                return;
            }

            setQueueError(
                data.message,
            );
        }

        function handleMusicPlaybackUpdated(
            data: {
                playback: MediaPlaybackState;
            },
        ) {
            if (roomType !== "music") {
                return;
            }

            setPlayback(
                data.playback,
            );
        }

        function handleMusicPlaybackError(
            data: {
                message: string;
            },
        ) {
            if (roomType !== "music") {
                return;
            }

            console.error(
                "Music playback error:",
                data.message,
            );
        }

        function handleVideoQueueUpdated(
            data: {
                queue: MediaItem[];
            },
        ) {
            if (roomType !== "video") {
                return;
            }

            setQueue(data.queue);
            setQueueError("");
        }

        function handleVideoQueueError(
            data: {
                message: string;
            },
        ) {
            if (roomType !== "video") {
                return;
            }

            setQueueError(
                data.message,
            );
        }

        function handleVideoPlaybackUpdated(
            data: {
                playback: MediaPlaybackState;
            },
        ) {
            if (roomType !== "video") {
                return;
            }

            setPlayback(
                data.playback,
            );
        }

        function handleVideoPlaybackError(
            data: {
                message: string;
            },
        ) {
            if (roomType !== "video") {
                return;
            }

            console.error(
                "Video playback error:",
                data.message,
            );
        }

        socket.on(
            "connect",
            handleConnect,
        );

        socket.on(
            "disconnect",
            handleDisconnect,
        );

        socket.on(
            "room:joined",
            handleRoomJoined,
        );

        socket.on(
            "room:error",
            handleRoomError,
        );

        socket.on(
            "room:participants",
            handleParticipants,
        );

        socket.on(
            "room:seat-error",
            handleSeatError,
        );

        socket.on(
            "chat:message",
            handleChatMessage,
        );

        socket.on(
            "chat:error",
            handleChatError,
        );

        socket.on(
            "music:queue-updated",
            handleMusicQueueUpdated,
        );

        socket.on(
            "music:queue-error",
            handleMusicQueueError,
        );

        socket.on(
            "music:playback-updated",
            handleMusicPlaybackUpdated,
        );

        socket.on(
            "music:playback-error",
            handleMusicPlaybackError,
        );

        socket.on(
            "video:queue-updated",
            handleVideoQueueUpdated,
        );

        socket.on(
            "video:queue-error",
            handleVideoQueueError,
        );

        socket.on(
            "video:playback-updated",
            handleVideoPlaybackUpdated,
        );

        socket.on(
            "video:playback-error",
            handleVideoPlaybackError,
        );

        if (socket.connected) {
            handleConnect();
        } else {
            socket.connect();
        }

        return () => {
            socket.off(
                "connect",
                handleConnect,
            );

            socket.off(
                "disconnect",
                handleDisconnect,
            );

            socket.off(
                "room:joined",
                handleRoomJoined,
            );

            socket.off(
                "room:error",
                handleRoomError,
            );

            socket.off(
                "room:participants",
                handleParticipants,
            );

            socket.off(
                "room:seat-error",
                handleSeatError,
            );

            socket.off(
                "chat:message",
                handleChatMessage,
            );

            socket.off(
                "chat:error",
                handleChatError,
            );

            socket.off(
                "music:queue-updated",
                handleMusicQueueUpdated,
            );

            socket.off(
                "music:queue-error",
                handleMusicQueueError,
            );

            socket.off(
                "music:playback-updated",
                handleMusicPlaybackUpdated,
            );

            socket.off(
                "music:playback-error",
                handleMusicPlaybackError,
            );

            socket.off(
                "video:queue-updated",
                handleVideoQueueUpdated,
            );

            socket.off(
                "video:queue-error",
                handleVideoQueueError,
            );

            socket.off(
                "video:playback-updated",
                handleVideoPlaybackUpdated,
            );

            socket.off(
                "video:playback-error",
                handleVideoPlaybackError,
            );
        };
    }, [roomCode, router]);

    return {
        ready,
        room,
        participant,
        participants,
        messages,
        queue,
        queueError,
        playback,

        setQueueError,
        setMessages,
    };
}