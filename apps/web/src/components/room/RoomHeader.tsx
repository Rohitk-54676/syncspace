"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Copy,
  Crown,
  LogOut,
  Music2,
  Users,
  Video,
} from "lucide-react";

interface RoomHeaderProps {
  code: string;
  type: "music" | "video";
  maxSeats: number;
  participantCount: number;
  isHost: boolean;
  onLeave: () => void;
  onOpenPeople: () => void;
}

export default function RoomHeader({
  code,
  type,
  maxSeats,
  participantCount,
  isHost,
  onLeave,
  onOpenPeople,
}: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(
      () => setCopied(false),
      1600,
    );

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
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 sm:px-5 sm:py-3"
    >
      <div className="flex min-w-0 items-center gap-2">
        <TypeIcon
          size={16}
          className="shrink-0 text-[var(--color-accent)]"
        />

        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy room code"
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 font-mono text-sm font-semibold tracking-[0.12em] text-[var(--color-text)] transition-colors duration-200 hover:border-[var(--color-border-strong)]"
        >
          {code}

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
                <Check size={13} />
              </motion.span>
            ) : (
              <motion.span
                key="copy"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15 }}
                className="text-[var(--color-text-faint)]"
              >
                <Copy size={13} />
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {isHost && (
          <span className="hidden shrink-0 items-center gap-1 rounded-full border border-[var(--color-accent-soft-strong)] bg-[var(--color-accent-soft)] px-2 py-1 text-[11px] font-medium text-[var(--color-accent-strong)] sm:flex">
            <Crown size={11} />
            Host
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenPeople}
          aria-label={`People, ${participantCount} of ${maxSeats}`}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-muted)] transition-colors duration-200 hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
        >
          <Users size={14} />
          {participantCount}/{maxSeats}
        </button>

        <button
          type="button"
          onClick={onLeave}
          aria-label="Leave room"
          className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-muted)] transition-colors duration-200 hover:border-[var(--color-danger)]/40 hover:text-[var(--color-danger)]"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">Leave</span>
        </button>
      </div>
    </motion.header>
  );
}