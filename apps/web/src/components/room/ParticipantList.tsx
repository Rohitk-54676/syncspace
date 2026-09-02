"use client";

import { Crown } from "lucide-react";
import type { ActiveParticipant } from "@syncspace/shared";

interface ParticipantListProps {
  participants: ActiveParticipant[];
  currentParticipantId: string;
  maxSeats: number;
}

function initialFor(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export default function ParticipantList({
  participants,
  currentParticipantId,
  maxSeats,
}: ParticipantListProps) {
  return (
    <section className="area-participants flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-[var(--color-text)]">
          People
        </h2>

        <p className="text-sm text-[var(--color-text-muted)]">
          {participants.length} / {maxSeats}
        </p>
      </div>

      <ul className="mt-4 space-y-2">
        {participants.map((member) => {
          const isMe =
            member.participantId === currentParticipantId;

          return (
            <li
              key={member.participantId}
              className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5"
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                  isMe
                    ? "bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]"
                    : "bg-[var(--color-surface-3)] text-[var(--color-text-muted)]"
                }`}
              >
                {initialFor(member.displayName)}
              </div>

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium text-[var(--color-text)]">
                  <span className="truncate">
                    {member.displayName}
                  </span>

                  {isMe && (
                    <span className="shrink-0 text-xs font-normal text-[var(--color-text-faint)]">
                      you
                    </span>
                  )}
                </p>

                <p className="text-xs text-[var(--color-text-faint)]">
                  {member.seat !== null
                    ? `Seat ${member.seat}`
                    : "No seat"}
                </p>
              </div>

              {member.isHost && (
                <Crown
                  size={15}
                  className="shrink-0 text-[var(--color-accent)]"
                  aria-label="Host"
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}