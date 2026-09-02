"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Crown } from "lucide-react";
import type { ActiveParticipant } from "@syncspace/shared";

interface SeatGridProps {
  maxSeats: number;
  participants: ActiveParticipant[];
  currentParticipantId: string;
  onSeatChange: (seat: number) => void;
}

export default function SeatGrid({
  maxSeats,
  participants,
  currentParticipantId,
  onSeatChange,
}: SeatGridProps) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="area-seats rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
      <div>
        <h2 className="text-base font-semibold text-[var(--color-text)]">
          Seats
        </h2>

        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Pick an open seat to join in.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
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
              whileHover={
                !isTaken && !reduceMotion
                  ? { y: -2 }
                  : undefined
              }
              whileTap={
                !isTaken && !reduceMotion
                  ? { scale: 0.96 }
                  : undefined
              }
              transition={{ duration: 0.15 }}
              aria-pressed={isMe}
              aria-label={
                occupant
                  ? isMe
                    ? `Seat ${seat}, your seat`
                    : `Seat ${seat}, taken by ${occupant.displayName}`
                  : `Seat ${seat}, available`
              }
              className={`relative flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-center transition-colors duration-200 ${
                isMe
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                  : isTaken
                    ? "cursor-not-allowed border-[var(--color-border)] bg-[var(--color-surface-2)] opacity-70"
                    : "border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-3)]"
              }`}
            >
              {occupant?.isHost && (
                <Crown
                  size={12}
                  className="absolute right-2 top-2 text-[var(--color-accent)]"
                />
              )}

              <span
                className={`text-[11px] font-medium ${
                  isMe
                    ? "text-[var(--color-accent-strong)]"
                    : "text-[var(--color-text-faint)]"
                }`}
              >
                Seat {seat}
              </span>

              <span className="w-full truncate text-sm font-medium text-[var(--color-text)]">
                {occupant
                  ? isMe
                    ? "You"
                    : occupant.displayName
                  : "Open"}
              </span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}