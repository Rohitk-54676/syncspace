"use client";

import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Crown } from "lucide-react";
import type { ActiveParticipant } from "@syncspace/shared";

interface SeatGridProps {
  maxSeats: number;
  participants: ActiveParticipant[];
  currentParticipantId: string;
  onSeatChange: (seat: number) => void;
}

function initialFor(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export default function SeatGrid({
  maxSeats,
  participants,
  currentParticipantId,
  onSeatChange,
}: SeatGridProps) {
  const reduceMotion = useReducedMotion();

  // Always exactly two rows: columns = ceil(maxSeats / 2).
  const columns = Math.max(1, Math.ceil(maxSeats / 2));

  return (
    <section
      className="room-seats-slot border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 sm:px-5"
      aria-label="Seats"
    >
      <div
        className="grid gap-x-2 gap-y-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        <AnimatePresence initial={false}>
          {Array.from({ length: maxSeats }, (_, index) => {
            const seat = index + 1;

            const occupant = participants.find(
              (member) => member.seat === seat,
            );

            const isMe =
              occupant?.participantId === currentParticipantId;

            const isTaken = Boolean(occupant) && !isMe;

            return (
              <motion.button
                key={seat}
                type="button"
                disabled={isTaken}
                onClick={() => onSeatChange(seat)}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                whileTap={!isTaken && !reduceMotion ? { scale: 0.93 } : undefined}
                transition={{ duration: 0.18 }}
                aria-pressed={isMe}
                aria-label={
                  occupant
                    ? isMe
                      ? `Seat ${seat}, your seat`
                      : `Seat ${seat}, taken by ${occupant.displayName}`
                    : `Seat ${seat}, available`
                }
                className="flex flex-col items-center gap-1"
              >
                <span
                  className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors duration-200 sm:h-11 sm:w-11 ${
                    isMe
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]"
                      : occupant
                        ? "cursor-not-allowed border-[var(--color-border)] bg-[var(--color-surface-3)] text-[var(--color-text-muted)]"
                        : "border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-2)] text-[var(--color-text-faint)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                  }`}
                >
                  {occupant ? initialFor(occupant.displayName) : ""}

                  {occupant?.isHost && (
                    <Crown
                      size={10}
                      className="absolute -right-0.5 -top-0.5 rounded-full bg-[var(--color-surface)] p-[1px] text-[var(--color-accent)]"
                    />
                  )}
                </span>

                <span className="max-w-[52px] truncate text-[10px] text-[var(--color-text-faint)]">
                  {occupant ? (isMe ? "You" : occupant.displayName) : "Open"}
                </span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}