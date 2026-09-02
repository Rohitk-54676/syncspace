"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import type {
    ActiveParticipant,
    ChatMessage,
    MediaItem,
    MediaPlaybackState,
} from "@syncspace/shared";

import { getGuestIdentity } from "@/lib/guest";
import { getRoom } from "@/lib/room";
import { socket } from "@/lib/socket";

import YouTubeAdd from "@/components/music/YouTubeAdd";
import MusicPlayer from "@/components/music/MusicPlayer";
import MusicQueue from "@/components/music/MusicQueue";
import RoomHeader from "@/components/room/RoomHeader";
import SeatGrid from "@/components/room/SeatGrid";
import ParticipantList from "@/components/room/ParticipantList";
import RoomChat from "@/components/room/RoomChat";

export default function RoomPage() {
    const params = useParams<{ code: string }>();
    const router = useRouter();

    const [ready, setReady] = useState(false);

    const [room, setRoom] =
        useState<ReturnType<typeof getRoom>>(null);

    const [participant, setParticipant] =
        useState<ReturnType<typeof getGuestIdentity>>(null);

    const [participants, setParticipants] =
        useState<ActiveParticipant[]>([]);

    const [messages, setMessages] =
        useState<ChatMessage[]>([]);

    const [chatInput, setChatInput] = useState("");

    const [queue, setQueue] =
        useState<MediaItem[]>([]);

    const [queueError, setQueueError] = useState("");

    const [playback, setPlayback] =
        useState<MediaPlaybackState | null>(null);

    /*
     * ---------------------------------------------------------
     * CURRENT PARTICIPANT
     * ---------------------------------------------------------
     */

    const currentParticipant = participant
        ? participants.find(
              (member) =>
                  member.participantId ===
                  participant.participantId,
          )
        : null;

    const isHost =
        currentParticipant?.isHost === true;

    /*
     * ---------------------------------------------------------
     * CURRENT MEDIA
     * ---------------------------------------------------------
     */

    const currentMedia =
        playback?.currentIndex !== null &&
        playback?.currentIndex !== undefined &&
        queue[playback.currentIndex]
            ? queue[playback.currentIndex]
            : null;

    /*
     * ---------------------------------------------------------
     * SEAT CHANGE
     * ---------------------------------------------------------
     */

    function handleSeatChange(seat: number) {
        if (!participant) {
            return;
        }

        socket.emit("room:seat-change", {
            participantId:
                participant.participantId,
            seat,
        });
    }

    /*
     * ---------------------------------------------------------
     * ADD MUSIC
     * ---------------------------------------------------------
     */

    function handleAddToQueue(media: MediaItem) {
        setQueueError("");

        socket.emit("music:queue-add", {
            media,
        });
    }

    /*
     * ---------------------------------------------------------
     * ROOM / SOCKET SETUP
     * ---------------------------------------------------------
     */

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

        const routeCode =
            params.code.toUpperCase();

        if (
            storedRoom.code !==
            routeCode
        ) {
            router.replace("/");
            return;
        }

        setRoom(storedRoom);
        setParticipant(storedParticipant);

        /*
         * -----------------------------------------------------
         * ROOM JOINED
         * -----------------------------------------------------
         */

        function handleRoomJoined(data: {
            room: {
                id: string;
                code: string;
                type: "music" | "video";
                maxSeats: number;
            };
            participant: ActiveParticipant;
        }) {
            console.log(
                "Realtime room joined:",
                data,
            );

            /*
             * Keep local identity synchronized with
             * the server's participant record.
             *
             * Seat and host information comes from
             * room:participants, so we don't duplicate
             * that state here.
             */
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

        /*
         * -----------------------------------------------------
         * ROOM ERROR
         * -----------------------------------------------------
         */

        function handleRoomError(data: {
            message: string;
        }) {
            console.error(
                "Realtime room error:",
                data.message,
            );

            /*
             * Do not destroy local room state
             * during a transient reconnect.
             */
            setReady(false);
        }

        /*
         * -----------------------------------------------------
         * SOCKET CONNECT
         * -----------------------------------------------------
         */

        function handleConnect() {
            const currentRoom = getRoom();
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
                roomId: currentRoom.id,
                participantId:
                    currentParticipant.participantId,
                displayName:
                    currentParticipant.displayName,
            });
        }

        /*
         * -----------------------------------------------------
         * SOCKET DISCONNECT
         * -----------------------------------------------------
         */

        function handleDisconnect(
            reason: string,
        ) {
            console.log(
                "Socket disconnected:",
                reason,
            );

            /*
             * Do not clear room state.
             * Socket.IO handles reconnection.
             */
        }

        /*
         * -----------------------------------------------------
         * PARTICIPANTS
         * -----------------------------------------------------
         */

        function handleParticipants(data: {
            participants: ActiveParticipant[];
        }) {
            console.log(
                "Realtime participants:",
                data.participants,
            );

            setParticipants(
                data.participants,
            );
        }

        /*
         * -----------------------------------------------------
         * SEAT ERROR
         * -----------------------------------------------------
         */

        function handleSeatError(data: {
            message: string;
        }) {
            console.error(
                "Seat change failed:",
                data.message,
            );
        }

        /*
         * -----------------------------------------------------
         * CHAT MESSAGE
         * -----------------------------------------------------
         */

        function handleChatMessage(
            message: ChatMessage,
        ) {
            setMessages((current) => [
                ...current,
                message,
            ]);
        }

        /*
         * -----------------------------------------------------
         * CHAT ERROR
         * -----------------------------------------------------
         */

        function handleChatError(data: {
            message: string;
        }) {
            console.error(
                "Chat error:",
                data.message,
            );
        }

        /*
         * -----------------------------------------------------
         * QUEUE UPDATED
         * -----------------------------------------------------
         */

        function handleQueueUpdated(data: {
            queue: MediaItem[];
        }) {
            console.log(
                "Music queue updated:",
                data.queue,
            );

            setQueue(data.queue);
            setQueueError("");
        }

        /*
         * -----------------------------------------------------
         * QUEUE ERROR
         * -----------------------------------------------------
         */

        function handleQueueError(data: {
            message: string;
        }) {
            console.error(
                "Music queue error:",
                data.message,
            );

            setQueueError(
                data.message,
            );
        }

        /*
         * -----------------------------------------------------
         * PLAYBACK UPDATED
         * -----------------------------------------------------
         */

        function handlePlaybackUpdated(data: {
            playback: MediaPlaybackState;
        }) {
            console.log(
                "Music playback updated:",
                data.playback,
            );

            setPlayback(
                data.playback,
            );
        }

        /*
         * -----------------------------------------------------
         * PLAYBACK ERROR
         * -----------------------------------------------------
         */

        function handlePlaybackError(data: {
            message: string;
        }) {
            console.error(
                "Music playback error:",
                data.message,
            );
        }

        /*
         * -----------------------------------------------------
         * REGISTER LISTENERS
         * -----------------------------------------------------
         */

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
            handleQueueUpdated,
        );

        socket.on(
            "music:queue-error",
            handleQueueError,
        );

        socket.on(
            "music:playback-updated",
            handlePlaybackUpdated,
        );

        socket.on(
            "music:playback-error",
            handlePlaybackError,
        );

        /*
         * -----------------------------------------------------
         * CONNECT
         * -----------------------------------------------------
         */

        if (socket.connected) {
            handleConnect();
        } else {
            socket.connect();
        }

        /*
         * -----------------------------------------------------
         * CLEANUP
         * -----------------------------------------------------
         */

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
                handleQueueUpdated,
            );

            socket.off(
                "music:queue-error",
                handleQueueError,
            );

            socket.off(
                "music:playback-updated",
                handlePlaybackUpdated,
            );

            socket.off(
                "music:playback-error",
                handlePlaybackError,
            );

            socket.disconnect();
        };
    }, [params.code, router]);

    /*
     * ---------------------------------------------------------
     * SEND CHAT
     * ---------------------------------------------------------
     */

    function handleSendMessage(
        event: React.FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        const message =
            chatInput.trim();

        if (!message) {
            return;
        }

        socket.emit("chat:send", {
            message,
        });

        setChatInput("");
    }

    /*
     * ---------------------------------------------------------
     * LOADING
     * ---------------------------------------------------------
     */

    if (
        !ready ||
        !room ||
        !participant
    ) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4">
                <div className="w-full max-w-md space-y-4">
                    <div className="h-24 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]" />

                    <div className="h-40 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]" />

                    <div className="h-28 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]" />

                    <p className="text-center text-sm text-[var(--color-text-faint)]">
                        Joining the room…
                    </p>
                </div>
            </main>
        );
    }

    /*
     * ---------------------------------------------------------
     * PAGE
     * ---------------------------------------------------------
     */

    return (
        <main className="min-h-screen bg-[var(--color-bg)] px-4 py-6 sm:px-6 sm:py-10">
            <div className="room-grid mx-auto max-w-6xl">
                {/* Header */}
                <div className="area-header">
                    <RoomHeader
                        code={room.code}
                        type={room.type}
                        maxSeats={room.maxSeats}
                        participantCount={
                            participants.length
                        }
                        isHost={isHost}
                    />
                </div>

                {/* Music player */}
                {room.type === "music" &&
                    currentMedia && (
                        <MusicPlayer
                            item={currentMedia}
                            isHost={isHost}
                            playback={playback}
                        />
                    )}

                {/* Music controls */}
                {room.type === "music" && (
                    <>
                        {isHost ? (
                            <div className="area-addmusic">
                                <YouTubeAdd
                                    onAddToQueue={
                                        handleAddToQueue
                                    }
                                />

                                {queueError && (
                                    <p className="mt-3 rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
                                        {queueError}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="area-addmusic rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
                                <h2 className="text-base font-semibold text-[var(--color-text)]">
                                    Music controls
                                </h2>

                                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                                    Only the host can add music to the queue.
                                </p>
                            </div>
                        )}

                        <MusicQueue
                            queue={queue}
                            playback={playback}
                        />
                    </>
                )}

                {/* Seats */}
                <SeatGrid
                    maxSeats={room.maxSeats}
                    participants={participants}
                    currentParticipantId={
                        participant.participantId
                    }
                    onSeatChange={
                        handleSeatChange
                    }
                />

                {/* Participants */}
                <ParticipantList
                    participants={participants}
                    currentParticipantId={
                        participant.participantId
                    }
                    maxSeats={room.maxSeats}
                />

                {/* Chat */}
                <RoomChat
                    messages={messages}
                    chatInput={chatInput}
                    onChangeChatInput={
                        setChatInput
                    }
                    onSendMessage={
                        handleSendMessage
                    }
                    currentParticipantId={
                        participant.participantId
                    }
                />
            </div>
        </main>
    );
}