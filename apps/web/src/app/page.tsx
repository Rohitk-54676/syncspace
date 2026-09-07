"use client";

import { FormEvent, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  DoorOpen,
  Headphones,
  Music2,
  Users,
  Video,
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

type RoomType = "music" | "video" | "voice";
type RoomAction = "create" | "join";

const ROOM_TYPES: Array<{
  type: RoomType;
  title: string;
  description: string;
  icon: typeof Music2;
  available: boolean;
}> = [
  {
    type: "music",
    title: "Music Room",
    description:
      "Listen to music together in perfect sync.",
    icon: Music2,
    available: true,
  },
  {
    type: "video",
    title: "Video Room",
    description:
      "Watch videos together while staying in sync.",
    icon: Video,
    available: true,
  },
  {
    type: "voice",
    title: "Voice Room",
    description:
      "Talk with friends in a shared voice room.",
    icon: Headphones,
    available: false,
  },
];

export default function Home() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [displayName, setDisplayName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  const [selectedRoomType, setSelectedRoomType] =
    useState<RoomType | null>(null);

  const [roomAction, setRoomAction] =
    useState<RoomAction | null>(null);

  const [maxSeats, setMaxSeats] = useState(6);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function selectRoomType(type: RoomType) {
    const selected =
      ROOM_TYPES.find((room) => room.type === type);

    if (!selected?.available) {
      return;
    }

    setSelectedRoomType(type);
    setRoomAction(null);
    setError("");
  }

  function goBackToRoomTypes() {
    setRoomAction(null);
    setError("");
  }

  async function handleCreateRoom(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!selectedRoomType) {
        throw new Error("Select a room type");
      }

      if (
        selectedRoomType !== "music" &&
        selectedRoomType !== "video"
      ) {
        throw new Error(
          "This room type is coming soon",
        );
      }

      if (!displayName.trim()) {
        throw new Error("Enter your display name");
      }

      const identity =
        await createGuestIdentity(
          displayName.trim(),
        );

      saveGuestIdentity(identity);

      const result =
        await createRoom(
          selectedRoomType,
          maxSeats,
        );

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
      if (!selectedRoomType) {
        throw new Error("Select a room type");
      }

      if (
        selectedRoomType !== "music" &&
        selectedRoomType !== "video"
      ) {
        throw new Error(
          "This room type is coming soon",
        );
      }

      if (!displayName.trim()) {
        throw new Error("Enter your display name");
      }

      if (!roomCode.trim()) {
        throw new Error("Enter a room code");
      }

      const identity =
        await createGuestIdentity(
          displayName.trim(),
        );

      saveGuestIdentity(identity);

      const result =
        await joinRoom(roomCode.trim());

      /*
       * The room type comes from the server.
       *
       * The selected card is only part of the
       * navigation flow. The backend remains
       * authoritative over the actual room.
       */
      if (
        result.room.type !==
        selectedRoomType
      ) {
        throw new Error(
          `This is a ${result.room.type} room. Select the matching room type to join it.`,
        );
      }

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

  const selectedRoom = ROOM_TYPES.find(
    (room) =>
      room.type === selectedRoomType,
  );

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[var(--color-bg)] px-4 py-8 text-[var(--color-text)] sm:px-6 sm:py-12 lg:py-16">
      {/* -------------------------------------------------
          AMBIENT BACKGROUND
      ------------------------------------------------- */}

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
              : {
                  opacity: 0,
                  y: 16,
                }
          }
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.5,
          }}
          className="mx-auto max-w-2xl text-center"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl shadow-black/20">
            <Headphones
              size={25}
              className="text-[var(--color-accent)]"
            />
          </div>

          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">
            Private shared rooms
          </p>

          <h1 className="mt-3 font-[var(--font-display)] text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            SyncSpace
          </h1>

          <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-[var(--color-text-muted)] sm:text-base">
            Create a private space and enjoy
            music, videos, and conversations
            together.
          </p>
        </motion.header>

        {/* -------------------------------------------------
            DISPLAY NAME
        ------------------------------------------------- */}

        <motion.section
          initial={
            reduceMotion
              ? false
              : {
                  opacity: 0,
                  y: 18,
                }
          }
          animate={{
            opacity: 1,
            y: 0,
          }}
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
              setDisplayName(
                event.target.value,
              )
            }
            maxLength={30}
            placeholder="What should your friends call you?"
            autoComplete="nickname"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 text-sm text-[var(--color-text)] outline-none transition-all duration-200 placeholder:text-[var(--color-text-faint)] hover:border-[var(--color-border-strong)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-soft)]"
          />

          <div className="mt-2 flex items-center justify-between text-xs text-[var(--color-text-faint)]">
            <span>
              Used only for this room
            </span>

            <span>
              {displayName.length}/30
            </span>
          </div>
        </motion.section>

        {/* -------------------------------------------------
            ROOM TYPE SELECTION
        ------------------------------------------------- */}

        {!selectedRoomType && (
          <motion.section
            initial={
              reduceMotion
                ? false
                : {
                    opacity: 0,
                    y: 20,
                  }
            }
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.5,
              delay: 0.14,
            }}
            className="mt-12"
          >
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
                Choose a room
              </p>

              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                What do you want to do together?
              </h2>

              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                Pick a room type to continue.
              </p>
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {ROOM_TYPES.map(
                ({
                  type,
                  title,
                  description,
                  icon: Icon,
                  available,
                }) => (
                  <motion.button
                    key={type}
                    type="button"
                    disabled={!available}
                    whileHover={
                      available &&
                      !reduceMotion
                        ? {
                            y: -3,
                          }
                        : undefined
                    }
                    whileTap={
                      available &&
                      !reduceMotion
                        ? {
                            scale: 0.985,
                          }
                        : undefined
                    }
                    onClick={() =>
                      selectRoomType(type)
                    }
                    className={`group relative overflow-hidden rounded-2xl border p-6 text-left transition-all duration-200 ${
                      available
                        ? "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]"
                        : "cursor-not-allowed border-[var(--color-border)] bg-[var(--color-surface)] opacity-55"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                          available
                            ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                            : "bg-[var(--color-surface-3)] text-[var(--color-text-muted)]"
                        }`}
                      >
                        <Icon size={22} />
                      </div>

                      {!available && (
                        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
                          Coming soon
                        </span>
                      )}
                    </div>

                    <h3 className="mt-6 text-lg font-semibold">
                      {title}
                    </h3>

                    <p className="mt-2 text-sm leading-5 text-[var(--color-text-muted)]">
                      {description}
                    </p>

                    {available && (
                      <div className="mt-6 flex items-center gap-1.5 text-xs font-semibold text-[var(--color-accent)]">
                        Continue
                        <ArrowRight size={14} />
                      </div>
                    )}
                  </motion.button>
                ),
              )}
            </div>
          </motion.section>
        )}

        {/* -------------------------------------------------
            SELECTED ROOM / ACTION
        ------------------------------------------------- */}

        {selectedRoomType && (
          <motion.section
            initial={
              reduceMotion
                ? false
                : {
                    opacity: 0,
                    y: 16,
                  }
            }
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.4,
            }}
            className="mt-10"
          >
            {/* Selected room */}
            <div className="mx-auto max-w-2xl">
              <button
                type="button"
                onClick={goBackToRoomTypes}
                className="mb-5 flex items-center gap-2 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                <ArrowLeft size={15} />
                Change room type
              </button>

              <div className="rounded-2xl border border-[var(--color-accent-soft-strong)] bg-[var(--color-accent-soft)] p-4 sm:p-5">
                <div className="flex items-center gap-4">
                  {selectedRoom && (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface)] text-[var(--color-accent)]">
                      <selectedRoom.icon
                        size={20}
                      />
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
                      Selected room
                    </p>

                    <h2 className="mt-0.5 text-lg font-semibold">
                      {selectedRoom?.title}
                    </h2>
                  </div>

                  <div className="ml-auto hidden items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] sm:flex">
                    <Check size={14} />
                    Ready
                  </div>
                </div>
              </div>

              {/* Create / Join switch */}
              <div className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5">
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setRoomAction("create");
                      setError("");
                    }}
                    className={`rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                      roomAction === "create"
                        ? "bg-[var(--color-accent)] text-black shadow-sm"
                        : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    Create room
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRoomAction("join");
                      setError("");
                    }}
                    className={`rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                      roomAction === "join"
                        ? "bg-[var(--color-accent)] text-black shadow-sm"
                        : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    Join room
                  </button>
                </div>
              </div>
            </div>

            {/* -------------------------------------------------
                CREATE FORM
            ------------------------------------------------- */}

            {roomAction === "create" && (
              <motion.form
                initial={
                  reduceMotion
                    ? false
                    : {
                        opacity: 0,
                        y: 12,
                      }
                }
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                onSubmit={
                  handleCreateRoom
                }
                className="mx-auto mt-4 max-w-2xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6"
              >
                <div>
                  <h3 className="text-lg font-semibold">
                    Create your{" "}
                    {selectedRoom?.title.toLowerCase()}
                  </h3>

                  <p className="mt-1.5 text-sm leading-5 text-[var(--color-text-muted)]">
                    Start a private room and
                    invite your friends with a
                    room code.
                  </p>
                </div>

                {/* Seats */}
                <div className="mt-6">
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
                        Number(
                          event.target.value,
                        ),
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
            )}

            {/* -------------------------------------------------
                JOIN FORM
            ------------------------------------------------- */}

            {roomAction === "join" && (
              <motion.form
                initial={
                  reduceMotion
                    ? false
                    : {
                        opacity: 0,
                        y: 12,
                      }
                }
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                onSubmit={
                  handleJoinRoom
                }
                className="mx-auto mt-4 max-w-2xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6"
              >
                <div>
                  <h3 className="text-lg font-semibold">
                    Join a{" "}
                    {selectedRoom?.title.toLowerCase()}
                  </h3>

                  <p className="mt-1.5 text-sm leading-5 text-[var(--color-text-muted)]">
                    Enter the code shared by
                    your host and join the
                    session.
                  </p>
                </div>

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
                          .replace(
                            /[^A-Z0-9]/g,
                            "",
                          ),
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
                    Room codes are private.
                    Ask the host to share
                    yours with you.
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
            )}
          </motion.section>
        )}

        {/* -------------------------------------------------
            ERROR
        ------------------------------------------------- */}

        {error && (
          <motion.div
            initial={
              reduceMotion
                ? false
                : {
                    opacity: 0,
                    y: 8,
                  }
            }
            animate={{
              opacity: 1,
              y: 0,
            }}
            role="alert"
            className="mx-auto mt-5 max-w-2xl rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]"
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
              : {
                  opacity: 0,
                }
          }
          animate={{
            opacity: 1,
          }}
          transition={{
            duration: 0.5,
            delay: 0.3,
          }}
          className="mt-10 text-center text-xs text-[var(--color-text-faint)]"
        >
          No account required · Temporary
          private rooms · 6–10 people
        </motion.p>
      </div>
    </main>
  );
}