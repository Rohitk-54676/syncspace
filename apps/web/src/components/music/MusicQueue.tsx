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

  return (
    <section className="area-queue flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            Queue
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {queue.length === 0
              ? "No songs yet."
              : `${queue.length} ${queue.length === 1 ? "song" : "songs"}`}
          </p>
        </div>

        {queue.length > 0 && playback && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-muted)]">
            <ModeIcon size={12} />
            {modeMeta.label}
          </span>
        )}
      </div>

      {queue.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--color-text-faint)]">
          The host can add a YouTube song to get things started.
        </p>
      ) : (
        <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {queue.map((media, index) => {
              const isCurrent = playback?.currentIndex === index;
              const isPlaying = isCurrent && playback?.isPlaying;

              return (
                <motion.div
                  key={`${media.mediaId}-${index}`}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-center gap-3 rounded-xl border p-3 ${
                    isCurrent
                      ? "border-[var(--color-accent-soft-strong)] bg-[var(--color-accent-soft)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface-2)]"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                      isCurrent
                        ? "bg-[var(--color-accent)] text-black"
                        : "bg-[var(--color-surface-3)] text-[var(--color-text-muted)]"
                    }`}
                  >
                    {isPlaying ? (
                      <span className="eq" aria-hidden="true">
                        <span className="eq-bar" />
                        <span className="eq-bar" />
                        <span className="eq-bar" />
                      </span>
                    ) : (
                      index + 1
                    )}
                  </div>

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
                    <p className="truncate text-sm font-medium text-[var(--color-text)]">
                      {media.title}
                    </p>
                    {media.duration !== null && (
                      <p className="mt-0.5 text-xs text-[var(--color-text-faint)]">
                        {formatDuration(media.duration)}
                      </p>
                    )}
                  </div>

                  {isCurrent && (
                    <span className="shrink-0 text-xs font-medium text-[var(--color-accent-strong)]">
                      Now playing
                    </span>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}