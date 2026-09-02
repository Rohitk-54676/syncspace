"use client";

import { FormEvent, useState } from "react";
import {
  Headphones,
  Music2,
  Users,
  Video,
  ArrowRight,
  DoorOpen,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import {
  createGuestIdentity,
  createRoom,
  joinRoom,
} from "@/lib/api";
import { saveGuestIdentity } from "@/lib/guest";
import { saveRoom } from "@/lib/room";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [displayName, setDisplayName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [roomType, setRoomType] =
    useState<"music" | "video">("music");
  const [maxSeats, setMaxSeats] = useState(6);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreateRoom(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!displayName.trim()) {
        throw new Error("Enter your display name");
      }

      const identity =
        await createGuestIdentity(displayName);

      saveGuestIdentity(identity);

      const result =
        await createRoom(roomType, maxSeats);

      saveRoom(result.room);

      router.push(
        `/room/${result.room.code}`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinRoom(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!displayName.trim()) {
        throw new Error("Enter your display name");
      }

      if (!roomCode.trim()) {
        throw new Error("Enter a room code");
      }

      const identity =
        await createGuestIdentity(displayName);

      saveGuestIdentity(identity);

      const result =
        await joinRoom(roomCode);

      saveRoom(result.room);

      router.push(
        `/room/${result.room.code}`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--color-bg)] px-4 py-8 text-[var(--color-text)] sm:px-6 sm:py-12 lg:py-16">
      {/* Ambient background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[var(--color-accent)] opacity-[0.06] blur-[120px]" />

        <div className="absolute bottom-[-220px] right-[-120px] h-[420px] w-[420px] rounded-full bg-[var(--color-accent)] opacity-[0.035] blur-[120px]" />
      </div>

      <div className="relative mx-auto w-full max-w-5xl">
        {/* -------------------------------------------------
            HERO
        ------------------------------------------------- */}

        <motion.header
          initial={
            reduceMotion
              ? false
              : { opacity: 0, y: 16 }
          }
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl shadow-black/20">
            <Headphones
              size={25}
              className="text-[var(--color-accent)]"
            />
          </div>

          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">
            Private listening rooms
          </p>

          <h1 className="mt-3 font-[var(--font-display)] text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            SyncSpace
          </h1>

          <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-[var(--color-text-muted)] sm:text-base">
            Create a private room and listen
            together in perfect sync.
          </p>
        </motion.header>

        {/* -------------------------------------------------
            DISPLAY NAME
        ------------------------------------------------- */}

        <motion.section
          initial={
            reduceMotion
              ? false
              : { opacity: 0, y: 18 }
          }
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            delay: 0.08,
          }}
          className="mx-auto mt-10 max-w-xl"
        >
          <label
            htmlFor="display-name"
            className="mb-2 block text-sm font-medium text-[var(--color-text)]"
          >
            Your display name
          </label>

          <input
            id="display-name"
            value={displayName}
            onChange={(event) =>
              setDisplayName(event.target.value)
            }
            maxLength={30}
            placeholder="What should your friends call you?"
            autoComplete="nickname"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 text-sm text-[var(--color-text)] outline-none transition-all duration-200 placeholder:text-[var(--color-text-faint)] hover:border-[var(--color-border-strong)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-soft)]"
          />

          <div className="mt-2 flex items-center justify-between text-xs text-[var(--color-text-faint)]">
            <span>Used only for this room</span>
            <span>{displayName.length}/30</span>
          </div>
        </motion.section>

        {/* -------------------------------------------------
            ROOM ACTIONS
        ------------------------------------------------- */}

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {/* CREATE */}
          <motion.form
            initial={
              reduceMotion
                ? false
                : { opacity: 0, y: 20 }
            }
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              delay: 0.15,
            }}
            onSubmit={handleCreateRoom}
            className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-colors duration-200 hover:border-[var(--color-border-strong)] sm:p-6"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                <Music2 size={20} />
              </div>

              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
                Host
              </span>
            </div>

            <h2 className="mt-5 text-lg font-semibold">
              Create a room
            </h2>

            <p className="mt-1.5 text-sm leading-5 text-[var(--color-text-muted)]">
              Start a private space and invite
              your friends with a room code.
            </p>

            {/* Room type */}
            <div className="mt-6">
              <label
                htmlFor="room-type"
                className="mb-2 block text-xs font-medium text-[var(--color-text-muted)]"
              >
                Room type
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setRoomType("music")
                  }
                  className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm transition-all duration-200 ${
                    roomType === "music"
                      ? "border-[var(--color-accent-soft-strong)] bg-[var(--color-accent-soft)] text-[var(--color-text)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  <Music2 size={16} />

                  <span className="font-medium">
                    Music
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setRoomType("video")
                  }
                  className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm transition-all duration-200 ${
                    roomType === "video"
                      ? "border-[var(--color-accent-soft-strong)] bg-[var(--color-accent-soft)] text-[var(--color-text)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  <Video size={16} />

                  <span className="font-medium">
                    Video
                  </span>
                </button>
              </div>

              <select
                id="room-type"
                value={roomType}
                onChange={(event) =>
                  setRoomType(
                    event.target.value as
                      | "music"
                      | "video",
                  )
                }
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
              >
                <option value="music">
                  Music
                </option>
                <option value="video">
                  Video
                </option>
              </select>
            </div>

            {/* Seats */}
            <div className="mt-4">
              <label
                htmlFor="max-seats"
                className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)]"
              >
                <Users size={13} />
                Seats
              </label>

              <select
                id="max-seats"
                value={maxSeats}
                onChange={(event) =>
                  setMaxSeats(
                    Number(event.target.value),
                  )
                }
                className="w-full appearance-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-3 text-sm text-[var(--color-text)] outline-none transition-colors duration-200 hover:border-[var(--color-border-strong)] focus:border-[var(--color-accent)]"
              >
                {[6, 7, 8, 9, 10].map(
                  (seats) => (
                    <option
                      key={seats}
                      value={seats}
                    >
                      {seats} seats
                    </option>
                  ),
                )}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-3.5 text-sm font-semibold text-black transition-all duration-200 hover:bg-[var(--color-accent-strong)] hover:shadow-lg hover:shadow-[var(--color-accent-soft-strong)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  Creating room...
                </>
              ) : (
                <>
                  Create room
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </motion.form>

          {/* JOIN */}
          <motion.form
            initial={
              reduceMotion
                ? false
                : { opacity: 0, y: 20 }
            }
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              delay: 0.22,
            }}
            onSubmit={handleJoinRoom}
            className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-colors duration-200 hover:border-[var(--color-border-strong)] sm:p-6"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-surface-3)] text-[var(--color-text-muted)]">
                <DoorOpen size={20} />
              </div>

              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
                Guest
              </span>
            </div>

            <h2 className="mt-5 text-lg font-semibold">
              Join a room
            </h2>

            <p className="mt-1.5 text-sm leading-5 text-[var(--color-text-muted)]">
              Enter the code shared by your
              host and join the session.
            </p>

            <div className="mt-6">
              <label
                htmlFor="room-code"
                className="mb-2 block text-xs font-medium text-[var(--color-text-muted)]"
              >
                Room code
              </label>

              <input
                id="room-code"
                value={roomCode}
                onChange={(event) =>
                  setRoomCode(
                    event.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, ""),
                  )
                }
                maxLength={6}
                placeholder="EP4JZL"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3.5 text-center font-mono text-lg font-semibold tracking-[0.28em] text-[var(--color-text)] outline-none transition-all duration-200 placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-soft)]"
              />
            </div>

            <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-3">
              <p className="text-xs leading-5 text-[var(--color-text-faint)]">
                Room codes are private. Ask the
                host to share yours with you.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] px-4 py-3.5 text-sm font-semibold text-[var(--color-text)] transition-all duration-200 hover:border-[var(--color-accent-soft-strong)] hover:bg-[var(--color-surface-3)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-text-muted)] border-t-[var(--color-text)]" />
                  Joining room...
                </>
              ) : (
                <>
                  Join room
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </motion.form>
        </div>

        {/* -------------------------------------------------
            ERROR
        ------------------------------------------------- */}

        {error && (
          <motion.div
            initial={
              reduceMotion
                ? false
                : { opacity: 0, y: 8 }
            }
            animate={{ opacity: 1, y: 0 }}
            role="alert"
            className="mx-auto mt-5 max-w-xl rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]"
          >
            {error}
          </motion.div>
        )}

        {/* -------------------------------------------------
            FOOTER NOTE
        ------------------------------------------------- */}

        <motion.p
          initial={
            reduceMotion
              ? false
              : { opacity: 0 }
          }
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.5,
            delay: 0.3,
          }}
          className="mt-10 text-center text-xs text-[var(--color-text-faint)]"
        >
          No account required · Temporary private
          rooms · 6–10 people
        </motion.p>
      </div>
    </main>
  );
}