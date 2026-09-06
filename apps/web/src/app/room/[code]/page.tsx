"use client";

import { useParams, useRouter } from "next/navigation";

import type {
    MediaItem,
    PlaybackMode,
} from "@syncspace/shared";

import { useRoomSocket } from "@/hooks/room/useRoomSocket";
import { useRoomActions } from "@/hooks/room/useRoomActions";

import { clearGuestIdentity } from "@/lib/guest";
import { clearRoom } from "@/lib/room";
import { socket } from "@/lib/socket";

import RoomContent from "@/components/room/RoomContent";

export default function RoomPage() {
    const params =
        useParams<{
            code: string;
        }>();

    const router = useRouter();

    const roomCode =
        params.code.toUpperCase();

    const {
        ready,
        room,
        participant,
        participants,
        messages,
        queue,
        queueError,
        playback,
    } = useRoomSocket(roomCode);

    const {
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
    } = useRoomActions({
        roomType:
            room?.type ?? "music",
        participantId:
            participant?.participantId ??
            null,
    });

    function handleLeave() {
        socket.disconnect();

        clearRoom();
        clearGuestIdentity();

        router.replace("/");
    }

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

    function handleAddToQueue(
        media: MediaItem,
    ) {
        addToQueue(media);
    }

    function handleVideoSetMode(
        mode: PlaybackMode,
    ) {
        setVideoMode(mode);
    }

    return (
        <RoomContent
            room={room}
            participant={
                participant
            }
            participants={
                participants
            }
            messages={messages}
            queue={queue}
            queueError={
                queueError
            }
            playback={
                playback
            }
            onSeatChange={
                changeSeat
            }
            onAddToQueue={
                handleAddToQueue
            }
            onVideoPlay={
                playVideo
            }
            onVideoPause={
                pauseVideo
            }
            onVideoSeek={
                seekVideo
            }
            onVideoEnded={
                endVideo
            }
            onVideoNext={
                nextVideo
            }
            onVideoPrevious={
                previousVideo
            }
            onVideoSetMode={
                handleVideoSetMode
            }
            onSendMessage={
                sendChatMessage
            }
            onLeave={
                handleLeave
            }
        />
    );
}