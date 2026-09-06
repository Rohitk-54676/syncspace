"use client";

import { FormEvent, useState } from "react";
import { Plus} from "lucide-react";
import type { MediaItem } from "@syncspace/shared";
import { getYouTubeVideo } from "@/lib/youtube";

interface YouTubeAddProps {
    onAddToQueue: (
        media: MediaItem,
    ) => void;
}

export default function YouTubeAdd({
    onAddToQueue,
}: YouTubeAddProps) {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        const value = url.trim();

        if (!value) {
            setError(
                "Enter a YouTube URL",
            );
            return;
        }

        setLoading(true);
        setError("");

        try {
            const media =
                await getYouTubeVideo(value);

            if (!media) {
                throw new Error(
                    "Unable to find that YouTube video",
                );
            }

            onAddToQueue({
                ...media,
                mediaType: "video",
            });

            setUrl("");
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to add video",
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                </div>

                <div>
                    <h2 className="text-base font-semibold">
                        Add a video
                    </h2>

                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                        Paste a YouTube video link
                        to add it to the queue.
                    </p>
                </div>
            </div>

            <form
                onSubmit={handleSubmit}
                className="mt-5"
            >
                <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                        value={url}
                        onChange={(event) =>
                            setUrl(
                                event.target.value,
                            )
                        }
                        placeholder="https://youtube.com/watch?v=..."
                        type="url"
                        inputMode="url"
                        autoComplete="off"
                        spellCheck={false}
                        disabled={loading}
                        className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition-all duration-200 placeholder:text-[var(--color-text-faint)] hover:border-[var(--color-border-strong)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                    />

                    <button
                        type="submit"
                        disabled={
                            loading ||
                            !url.trim()
                        }
                        className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-black transition-all duration-200 hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {loading ? (
                            <>
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                                Loading...
                            </>
                        ) : (
                            <>
                                <Plus size={16} />
                                Add video
                            </>
                        )}
                    </button>
                </div>

                {error && (
                    <p
                        role="alert"
                        className="mt-3 rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]"
                    >
                        {error}
                    </p>
                )}
            </form>
        </div>
    );
}