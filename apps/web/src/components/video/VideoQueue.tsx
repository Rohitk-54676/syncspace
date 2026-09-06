"use client";

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
            <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
                <h2 className="text-base font-semibold">
                    Video queue
                </h2>

                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                    No videos have been added yet.
                </p>
            </section>
        );
    }

    return (
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-base font-semibold">
                        Video queue
                    </h2>

                    <p className="mt-1 text-xs text-[var(--color-text-faint)]">
                        {queue.length}{" "}
                        {queue.length === 1
                            ? "video"
                            : "videos"}
                    </p>
                </div>
            </div>

            <div className="mt-4 space-y-2">
                {queue.map(
                    (item, index) => {
                        const isCurrent =
                            playback?.currentIndex ===
                            index;

                        return (
                            <div
                                key={`${item.mediaId}-${index}`}
                                className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors ${
                                    isCurrent
                                        ? "border-[var(--color-accent-soft-strong)] bg-[var(--color-accent-soft)]"
                                        : "border-[var(--color-border)] bg-[var(--color-surface-2)]"
                                }`}
                            >
                                <span className="w-6 shrink-0 text-center text-xs font-medium text-[var(--color-text-faint)]">
                                    {index + 1}
                                </span>

                                {item.thumbnailUrl ? (
                                    <img
                                        src={
                                            item.thumbnailUrl
                                        }
                                        alt=""
                                        className="h-12 w-20 shrink-0 rounded-lg object-cover"
                                    />
                                ) : (
                                    <div className="h-12 w-20 shrink-0 rounded-lg bg-[var(--color-surface-3)]" />
                                )}

                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-[var(--color-text)]">
                                        {item.title}
                                    </p>

                                    {isCurrent && (
                                        <p className="mt-1 text-xs font-medium text-[var(--color-accent)]">
                                            {playback?.isPlaying
                                                ? "Playing"
                                                : "Paused"}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    },
                )}
            </div>
        </section>
    );
}