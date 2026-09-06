"use client";

import { useState } from "react";

import type {
    ActiveParticipant,
    ChatMessage,
    MediaItem,
    MediaPlaybackState,
    PlaybackMode,
} from "@syncspace/shared";

import YouTubeAdd from "@/components/music/YouTubeAdd";
import MusicPlayer from "@/components/music/MusicPlayer";
import MusicQueue from "@/components/music/MusicQueue";

import { VideoPlayer } from "@/components/video/VideoPlayer";
import VideoQueue from "@/components/video/VideoQueue";
import VideoYouTubeAdd from "@/components/video/YouTubeAdd";

import RoomHeader from "@/components/room/RoomHeader";
import SeatGrid from "@/components/room/SeatGrid";
import ParticipantList from "@/components/room/ParticipantList";
import RoomChat from "@/components/room/RoomChat";

interface RoomContentProps {
    room: {
        id: string;
        code: string;
        type: "music" | "video";
        maxSeats: number;
    };

    participant: {
        participantId: string;
        displayName: string;
    };

    participants: ActiveParticipant[];
    messages: ChatMessage[];

    queue: MediaItem[];
    queueError: string;
    playback: MediaPlaybackState | null;

    onSeatChange: (seat: number) => void;
    onAddToQueue: (media: MediaItem) => void;

    onVideoPlay: () => void;
    onVideoPause: () => void;
    onVideoSeek: (position: number) => void;
    onVideoEnded: () => void;
    onVideoNext: () => void;
    onVideoPrevious: () => void;
    onVideoSetMode: (
        mode: PlaybackMode,
    ) => void;

    onSendMessage: (
        message: string,
    ) => void;

    onLeave: () => void;
}

export default function RoomContent({
    room,
    participant,
    participants,
    messages,
    queue,
    queueError,
    playback,
    onSeatChange,
    onAddToQueue,
    onVideoPlay,
    onVideoPause,
    onVideoSeek,
    onVideoEnded,
    onVideoNext,
    onVideoPrevious,
    onVideoSetMode,
    onSendMessage,
    onLeave,
}: RoomContentProps) {
    const [chatInput, setChatInput] =
        useState("");

    const currentParticipant =
        participants.find(
            (member) =>
                member.participantId ===
                participant.participantId,
        );

    const isHost =
        currentParticipant?.isHost ===
        true;

    const currentMedia =
        playback?.currentIndex !== null &&
        playback?.currentIndex !==
            undefined &&
        queue[
            playback.currentIndex
        ]
            ? queue[
                  playback.currentIndex
              ]
            : null;

    function handleSendMessage(
        event: React.FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        const message =
            chatInput.trim();

        if (!message) {
            return;
        }

        onSendMessage(message);
        setChatInput("");
    }

    return (
        <main className="min-h-screen bg-[var(--color-bg)] px-4 py-6 sm:px-6 sm:py-10">
            <div className="room-grid mx-auto max-w-6xl">
                <div className="area-header">
                    <RoomHeader
                        code={room.code}
                        type={room.type}
                        maxSeats={
                            room.maxSeats
                        }
                        participantCount={
                            participants.length
                        }
                        isHost={isHost}
                        onLeave={onLeave}
                    />
                </div>

                {room.type ===
                    "music" &&
                    currentMedia && (
                        <MusicPlayer
                            item={currentMedia}
                            isHost={isHost}
                            playback={
                                playback
                            }
                        />
                    )}

                {room.type ===
                    "video" &&
                    currentMedia && (
                        <VideoPlayer
                            media={
                                currentMedia
                            }
                            playback={
                                playback
                            }
                            isHost={isHost}
                            onPlay={
                                onVideoPlay
                            }
                            onPause={
                                onVideoPause
                            }
                            onSeek={
                                onVideoSeek
                            }
                            onEnded={
                                onVideoEnded
                            }
                            onNext={
                                onVideoNext
                            }
                            onPrevious={
                                onVideoPrevious
                            }
                            onSetMode={
                                onVideoSetMode
                            }
                        />
                    )}

                {room.type ===
                    "music" && (
                    <>
                        {isHost ? (
                            <div className="area-addmusic">
                                <YouTubeAdd
                                    onAddToQueue={
                                        onAddToQueue
                                    }
                                />

                                {queueError && (
                                    <p className="mt-3 rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
                                        {
                                            queueError
                                        }
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
                            playback={
                                playback
                            }
                        />
                    </>
                )}

                {room.type ===
                    "video" && (
                    <>
                        {isHost ? (
                            <div className="area-addmusic">
                                <VideoYouTubeAdd
                                    onAddToQueue={
                                        onAddToQueue
                                    }
                                />

                                {queueError && (
                                    <p className="mt-3 rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
                                        {
                                            queueError
                                        }
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="area-addmusic rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
                                <h2 className="text-base font-semibold text-[var(--color-text)]">
                                    Video controls
                                </h2>

                                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                                    Only the host can add videos to the queue.
                                </p>
                            </div>
                        )}

                        <VideoQueue
                            queue={queue}
                            playback={
                                playback
                            }
                        />
                    </>
                )}

                <SeatGrid
                    maxSeats={
                        room.maxSeats
                    }
                    participants={
                        participants
                    }
                    currentParticipantId={
                        participant.participantId
                    }
                    onSeatChange={
                        onSeatChange
                    }
                />

                <ParticipantList
                    participants={
                        participants
                    }
                    currentParticipantId={
                        participant.participantId
                    }
                    maxSeats={
                        room.maxSeats
                    }
                />

                <RoomChat
                    messages={messages}
                    chatInput={
                        chatInput
                    }
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