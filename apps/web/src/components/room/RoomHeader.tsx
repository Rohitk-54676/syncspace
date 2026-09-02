"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Crown, Music2, Users, Video } from "lucide-react";

interface RoomHeaderProps {
  code: string;
  type: "music" | "video";
  maxSeats: number;
  participantCount: number;
  isHost: boolean;
}

export default function RoomHeader({
  code,
  type,
  maxSeats,
  participantCount,
  isHost,
}: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 1600);

    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      /* Clipboard permission denied — silently ignore, non-critical. */
    }
  }

  const TypeIcon = type === "music" ? Music2 : Video;

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
            <p className="text-sm font-medium text-[var(--color-text-muted)]">
              SyncSpace · Private Room
            </p>
          </div>

          <div className="mt-2 flex items-center gap-3">
            <h1
              className="font-[var(--font-display)] text-4xl font-semibold tracking-[0.08em] text-[var(--color-text)] sm:text-5xl"
              aria-label={`Room code ${code}`}
            >
              {code}
            </h1>

            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy room code"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] transition-colors duration-200 hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
            >
              <AnimatePresence mode="wait" initial={false}>
                {copied ? (
                  <motion.span
                    key="check"
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ duration: 0.15 }}
                    className="text-[var(--color-success)]"
                  >
                    <Check size={16} />
                  </motion.span>
                ) : (
                  <motion.span
                    key="copy"
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Copy size={16} />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>

        {isHost && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-accent-soft-strong)] bg-[var(--color-accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--color-accent-strong)]">
            <Crown size={13} />
            Host
          </span>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-[var(--color-border)] pt-5 text-sm text-[var(--color-text-muted)]">
        <span className="flex items-center gap-2">
          <TypeIcon size={16} className="text-[var(--color-text-faint)]" />
          <span className="capitalize">{type} room</span>
        </span>

        <span className="flex items-center gap-2">
          <Users size={16} className="text-[var(--color-text-faint)]" />
          {participantCount} / {maxSeats} in the room
        </span>
      </div>
    </motion.header>
  );
}