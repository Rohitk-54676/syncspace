"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ListMusic, Repeat, Repeat1, Shuffle } from "lucide-react";
import type { MediaItem, MediaPlaybackState } from "@syncspace/shared";

interface MusicQueueProps {
  queue: MediaItem[];
  playback: MediaPlaybackState | null;
}

const MODE_META = {
  normal: { label: "Normal", Icon: ListMusic },
  repeat_one: { label: "Repeat one", Icon: Repeat1 },
  repeat_queue: { label: "Repeat queue", Icon: Repeat },
  shuffle: { label: "Shuffle", Icon: Shuffle },
} as const;

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

export default function MusicQueue({ queue, playback }: MusicQueueProps) {
  const modeMeta = MODE_META[playback?.mode ?? "normal"];
  const ModeIcon = modeMeta.Icon;

  if (queue.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--color-text-faint)]">
        The host can add a YouTube song to get things started.
      </p>
    );
  }

  const currentIndex = playback?.currentIndex ?? null;

  const currentItem =
    currentIndex !== null ? queue[currentIndex] ?? null : null;

  const upNext = queue
    .map((media, index) => ({ media, index }))
    .filter(({ index }) =>
      currentIndex === null ? true : index !== currentIndex,
    );

  return (
    <div className="space-y-5">
      {queue.length > 0 && playback && (
        <div className="flex justify-end">
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-muted)]">
            <ModeIcon size={12} />
            {modeMeta.label}
          </span>
        </div>
      )}

      {currentItem && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
            Currently Playing
          </h3>

          <div className="flex items-center gap-3 rounded-xl border border-[var(--color-accent-soft-strong)] bg-[var(--color-accent-soft)] p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-black">
              {playback?.isPlaying ? (
                <span className="eq" aria-hidden="true">
                  <span className="eq-bar" />
                  <span className="eq-bar" />
                  <span className="eq-bar" />
                </span>
              ) : (
                <span className="text-xs font-medium">
                  {(currentIndex ?? 0) + 1}
                </span>
              )}
            </div>

            {currentItem.thumbnailUrl ? (
              <img
                src={currentItem.thumbnailUrl}
                alt=""
                className="h-10 w-14 shrink-0 rounded-md object-cover"
              />
            ) : (
              <div className="h-10 w-14 shrink-0 rounded-md bg-[var(--color-surface-3)]" />
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--color-text)]">
                {currentItem.title}
              </p>
              {currentItem.duration !== null && (
                <p className="mt-0.5 text-xs text-[var(--color-text-faint)]">
                  {formatDuration(currentItem.duration)}
                </p>
              )}
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
              {upNext.map(({ media, index }) => (
                <motion.div
                  key={`${media.mediaId}-${index}`}
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

                  {media.thumbnailUrl ? (
                    <img
                      src={media.thumbnailUrl}
                      alt=""
                      className="h-10 w-14 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="h-10 w-14 shrink-0 rounded-md bg-[var(--color-surface-3)]" />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[var(--color-text)]">
                      {media.title}
                    </p>
                    {media.duration !== null && (
                      <p className="mt-0.5 text-xs text-[var(--color-text-faint)]">
                        {formatDuration(media.duration)}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}