"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Plus } from "lucide-react";
import type { MediaItem } from "@syncspace/shared";
import { getYouTubeVideo } from "@/lib/youtube";

interface YouTubeAddProps {
  onAddToQueue: (media: MediaItem) => void;
}

export default function YouTubeAdd({ onAddToQueue }: YouTubeAddProps) {
  const [url, setUrl] = useState("");
  const [video, setVideo] = useState<MediaItem | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setVideo(null);
    setLoading(true);

    try {
      const result = await getYouTubeVideo(url);
      setVideo(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to fetch that video",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleAddToQueue() {
    if (!video) {
      return;
    }

    onAddToQueue(video);
    setVideo(null);
    setUrl("");
    setError("");
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-[var(--color-text)]">
        Add music
      </h2>

      <form onSubmit={handleLookup} className="mt-3 flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="Paste a YouTube link"
          aria-label="YouTube URL"
          className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)]"
        />

        <button
          type="submit"
          disabled={!url.trim() || loading}
          className="flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5 text-sm font-medium text-[var(--color-text)] transition-colors duration-200 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-3)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Plus size={15} />
          )}
          Add
        </button>
      </form>

      {error && (
        <p className="mt-3 rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}

      {video && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3"
        >
          <div className="flex gap-3">
            {video.thumbnailUrl && (
              <img
                src={video.thumbnailUrl}
                alt=""
                className="h-16 w-28 shrink-0 rounded-md object-cover"
              />
            )}

            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--color-text)]">
                {video.title}
              </p>
              {video.duration !== null && (
                <p className="mt-1 text-xs text-[var(--color-text-faint)]">
                  {Math.floor(video.duration / 60)}:
                  {String(video.duration % 60).padStart(2, "0")}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddToQueue}
            className="mt-3 w-full rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-black transition-colors duration-200 hover:bg-[var(--color-accent-strong)]"
          >
            Add to queue
          </button>
        </motion.div>
      )}
    </div>
  );
}