"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ListMusic, Plus, X } from "lucide-react";

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
    onVideoSetMode: (mode: PlaybackMode) => void;

    onSendMessage: (message: string) => void;

    onLeave: () => void;
}

type SheetKind = "queue" | "people" | null;

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
    const [chatInput, setChatInput] = useState("");
    const [openSheet, setOpenSheet] = useState<SheetKind>(null);
    const reduceMotion = useReducedMotion();

    const currentParticipant = participants.find(
        (member) => member.participantId === participant.participantId,
    );

    const isHost = currentParticipant?.isHost === true;

    const currentMedia =
        playback?.currentIndex !== null &&
        playback?.currentIndex !== undefined &&
        queue[playback.currentIndex]
            ? queue[playback.currentIndex]
            : null;

    function handleSendMessage(
        event: React.FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        const message = chatInput.trim();

        if (!message) {
            return;
        }

        onSendMessage(message);
        setChatInput("");
    }

    function handleAddToQueue(media: MediaItem) {
        onAddToQueue(media);
    }

    const closeSheet = () => setOpenSheet(null);

    return (
        <div className="room-shell">
            <div className="room-header-slot">
                <RoomHeader
                    code={room.code}
                    type={room.type}
                    maxSeats={room.maxSeats}
                    participantCount={participants.length}
                    isHost={isHost}
                    onLeave={onLeave}
                    onOpenPeople={() => setOpenSheet("people")}
                />
            </div>

            {/*
             * room-main: mobile = column (media, sidebar-contents
             * stack vertically). Desktop (>=1024px, see globals.css)
             * = row: media left, fixed-width sidebar right.
             */}
            <div className="room-main">
                {/* ---------------- MEDIA AREA ---------------- */}
                <div className="room-media-slot relative bg-black/20 px-3 pt-3 sm:px-5 sm:pt-4">
                    {room.type === "music" && currentMedia && (
                        <MusicPlayer
                            item={currentMedia}
                            isHost={isHost}
                            playback={playback}
                        />
                    )}

                    {room.type === "video" && currentMedia && (
                        <VideoPlayer
                            media={currentMedia}
                            playback={playback}
                            isHost={isHost}
                            onPlay={onVideoPlay}
                            onPause={onVideoPause}
                            onSeek={onVideoSeek}
                            onEnded={onVideoEnded}
                            onNext={onVideoNext}
                            onPrevious={onVideoPrevious}
                            onSetMode={onVideoSetMode}
                        />
                    )}

                    {!currentMedia && (
                        <div className="mx-auto flex aspect-video w-full max-w-2xl flex-col items-center justify-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-center">
                            <span className="text-4xl" aria-hidden="true">
                                {room.type === "video" ? "🎬" : "🎵"}
                            </span>

                            <div>
                                <p className="text-sm font-medium text-[var(--color-text)]">
                                    No {room.type === "video" ? "video" : "song"} playing
                                </p>

                                <p className="mt-1 text-xs text-[var(--color-text-faint)]">
                                    {isHost
                                        ? `Add your first ${room.type === "video" ? "video" : "song"} to get started`
                                        : "Waiting for the host to add something"}
                                </p>
                            </div>

                            {isHost && (
                                <button
                                    type="button"
                                    onClick={() => setOpenSheet("queue")}
                                    className="flex items-center gap-1.5 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-black transition-colors duration-200 hover:bg-[var(--color-accent-strong)]"
                                >
                                    <Plus size={15} />
                                    Add {room.type === "video" ? "Video" : "Song"}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Queue toggle, overlaid top-right of the media area */}
                    <button
                        type="button"
                        onClick={() => setOpenSheet("queue")}
                        aria-label="Open queue"
                        className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/90 text-[var(--color-text)] shadow-lg backdrop-blur transition-colors duration-200 hover:border-[var(--color-border-strong)]"
                    >
                        <ListMusic size={16} />
                    </button>
                </div>

                {/* ---------------- SIDEBAR: SEATS + CHAT ---------------- */}
                <div className="room-sidebar">
                    <SeatGrid
                        maxSeats={room.maxSeats}
                        participants={participants}
                        currentParticipantId={participant.participantId}
                        onSeatChange={onSeatChange}
                    />

                    {/* CHAT (only scrollable region) */}
                    <RoomChat
                        messages={messages}
                        chatInput={chatInput}
                        onChangeChatInput={setChatInput}
                        onSendMessage={handleSendMessage}
                        currentParticipantId={participant.participantId}
                    />
                </div>
            </div>

            {/* ---------------- QUEUE SHEET ---------------- */}
            <AnimatePresence>
                {openSheet === "queue" && (
                    <>
                        <motion.div
                            key="queue-backdrop"
                            className="sheet-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={closeSheet}
                        />

                        <motion.div
                            key="queue-sheet"
                            className="sheet-panel"
                            initial={
                                reduceMotion
                                    ? { opacity: 0 }
                                    : { y: "100%" }
                            }
                            animate={
                                reduceMotion
                                    ? { opacity: 1 }
                                    : { y: 0 }
                            }
                            exit={
                                reduceMotion
                                    ? { opacity: 0 }
                                    : { y: "100%" }
                            }
                            transition={{ duration: 0.28, ease: "easeOut" }}
                            role="dialog"
                            aria-label="Queue"
                        >
                            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
                                <h2 className="text-base font-semibold text-[var(--color-text)]">
                                    Queue
                                </h2>

                                <button
                                    type="button"
                                    onClick={closeSheet}
                                    aria-label="Close queue"
                                    className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                                {isHost && (
                                    <div className="mb-4">
                                        {room.type === "music" ? (
                                            <YouTubeAdd onAddToQueue={handleAddToQueue} />
                                        ) : (
                                            <VideoYouTubeAdd onAddToQueue={handleAddToQueue} />
                                        )}

                                        {queueError && (
                                            <p className="mt-3 rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
                                                {queueError}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {room.type === "music" ? (
                                    <MusicQueue queue={queue} playback={playback} />
                                ) : (
                                    <VideoQueue queue={queue} playback={playback} />
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ---------------- PEOPLE SHEET ---------------- */}
            <AnimatePresence>
                {openSheet === "people" && (
                    <>
                        <motion.div
                            key="people-backdrop"
                            className="sheet-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={closeSheet}
                        />

                        <motion.div
                            key="people-sheet"
                            className="sheet-panel"
                            initial={
                                reduceMotion
                                    ? { opacity: 0 }
                                    : { y: "100%" }
                            }
                            animate={
                                reduceMotion
                                    ? { opacity: 1 }
                                    : { y: 0 }
                            }
                            exit={
                                reduceMotion
                                    ? { opacity: 0 }
                                    : { y: "100%" }
                            }
                            transition={{ duration: 0.28, ease: "easeOut" }}
                            role="dialog"
                            aria-label="People"
                        >
                            <div className="flex items-center justify-end border-b border-[var(--color-border)] px-4 py-2">
                                <button
                                    type="button"
                                    onClick={closeSheet}
                                    aria-label="Close people list"
                                    className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                                <ParticipantList
                                    participants={participants}
                                    currentParticipantId={participant.participantId}
                                    maxSeats={room.maxSeats}
                                />
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}