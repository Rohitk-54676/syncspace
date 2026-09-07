"use client";

import { AnimatePresence, motion } from "framer-motion";
import type {
    MediaItem,
    MediaPlaybackState,
} from "@syncspace/shared";

interface VideoQueueProps {
    queue: MediaItem[];
    playback: MediaPlaybackState | null;
}

export default function VideoQueue({
    queue,
    playback,
}: VideoQueueProps) {
    if (queue.length === 0) {
        return (
            <p className="py-6 text-center text-sm text-[var(--color-text-faint)]">
                No videos have been added yet.
            </p>
        );
    }

    const currentIndex = playback?.currentIndex ?? null;

    const currentItem =
        currentIndex !== null
            ? queue[currentIndex] ?? null
            : null;

    const upNext = queue
        .map((item, index) => ({ item, index }))
        .filter(({ index }) =>
            currentIndex === null
                ? true
                : index !== currentIndex,
        );

    return (
        <div className="space-y-5">
            {currentItem && (
                <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
                        Currently Playing
                    </h3>

                    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-accent-soft-strong)] bg-[var(--color-accent-soft)] p-3">
                        {currentItem.thumbnailUrl ? (
                            <img
                                src={currentItem.thumbnailUrl}
                                alt=""
                                className="h-12 w-20 shrink-0 rounded-lg object-cover"
                            />
                        ) : (
                            <div className="h-12 w-20 shrink-0 rounded-lg bg-[var(--color-surface-3)]" />
                        )}

                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-[var(--color-text)]">
                                {currentItem.title}
                            </p>

                            <p className="mt-0.5 text-xs font-medium text-[var(--color-accent-strong)]">
                                {playback?.isPlaying ? "Playing" : "Paused"}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
                    Up Next
                </h3>

                {upNext.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-faint)]">
                        Nothing else queued.
                    </p>
                ) : (
                    <div className="space-y-2">
                        <AnimatePresence initial={false}>
                            {upNext.map(({ item, index }) => (
                                <motion.div
                                    key={`${item.mediaId}-${index}`}
                                    layout
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.18 }}
                                    className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2.5"
                                >
                                    <span className="w-5 shrink-0 text-center text-xs font-medium text-[var(--color-text-faint)]">
                                        {index + 1}
                                    </span>

                                    {item.thumbnailUrl ? (
                                        <img
                                            src={item.thumbnailUrl}
                                            alt=""
                                            className="h-10 w-16 shrink-0 rounded-md object-cover"
                                        />
                                    ) : (
                                        <div className="h-10 w-16 shrink-0 rounded-md bg-[var(--color-surface-3)]" />
                                    )}

                                    <p className="min-w-0 flex-1 truncate text-sm text-[var(--color-text)]">
                                        {item.title}
                                    </p>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}