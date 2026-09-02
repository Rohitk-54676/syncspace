"use client";

import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import YouTube, {
    type YouTubeProps,
    type YouTubePlayer as YouTubePlayerInstance,
} from "react-youtube";

import {
    ListMusic,
    Pause,
    Play,
    Repeat,
    Repeat1,
    Shuffle,
    SkipBack,
    SkipForward,
} from "lucide-react";

import type {
    MediaItem,
    MediaPlaybackState,
} from "@syncspace/shared";

import { socket } from "@/lib/socket";
import { IconButton } from "@/components/ui/IconButton";

interface MusicPlayerProps {
    item: MediaItem;
    isHost: boolean;
    playback: MediaPlaybackState | null;
}

export default function MusicPlayer({
    item,
    isHost,
    playback,
}: MusicPlayerProps) {
    /*
     * ---------------------------------------------------------
     * YOUTUBE PLAYER
     * ---------------------------------------------------------
     *
     * ONE persistent player instance.
     * Do NOT add key={item.mediaId}.
     */

    const playerRef =
        useRef<YouTubePlayerInstance | null>(null);

    const playerReadyRef = useRef(false);

    const videoReadyRef = useRef(false);

    const playerStateRef = useRef<number>(-1);

    const loadedMediaIdRef = useRef<string | null>(null);

    const pendingApplyRef = useRef<{
        mediaId: string;
        targetPosition: number;
        isPlaying: boolean;
    } | null>(null);

    const appliedPlaybackKeyRef =
        useRef<string | null>(null);

    /*
     * ---------------------------------------------------------
     * LOCAL STATE
     * ---------------------------------------------------------
     */

    const [isPlaying, setIsPlaying] = useState(false);

    const [currentTime, setCurrentTime] = useState(0);

    const [duration, setDuration] = useState(
        Number.isFinite(item.duration ?? 0)
            ? item.duration ?? 0
            : 0,
    );

    const [playerReady, setPlayerReady] = useState(false);

    const [videoReady, setVideoReady] = useState(false);

    /*
     * ---------------------------------------------------------
     * YOUTUBE OPTIONS
     * ---------------------------------------------------------
     */

    const options: YouTubeProps["opts"] = useMemo(
        () => ({
            width: "200",
            height: "200",
            playerVars: {
                autoplay: 0,
                controls: 0,
                rel: 0,
                modestbranding: 1,
            },
        }),
        [],
    );

    /*
     * ---------------------------------------------------------
     * HELPERS
     * ---------------------------------------------------------
     */

    function computeTargetPosition(
        pb: MediaPlaybackState,
    ): number {
        let target = Number.isFinite(pb.position)
            ? pb.position
            : 0;

        if (pb.isPlaying) {
            const elapsed =
                (Date.now() - pb.updatedAt) / 1000;

            if (Number.isFinite(elapsed)) {
                target += Math.max(0, elapsed);
            }
        }

        if (!Number.isFinite(target) || target < 0) {
            target = 0;
        }

        return target;
    }

    function applyPlaybackNow(
        player: YouTubePlayerInstance,
        targetPosition: number,
        shouldPlay: boolean,
    ) {
        try {
            player.seekTo(targetPosition, true);
        } catch (err) {
            console.error(
                "Failed to seek YouTube player:",
                err,
            );
        }

        try {
            if (shouldPlay) {
                player.playVideo();
            } else {
                player.pauseVideo();
                setIsPlaying(false);
            }
        } catch (err) {
            console.error(
                "Failed to apply play/pause state:",
                err,
            );
        }

        setCurrentTime(targetPosition);
    }

    /*
     * ---------------------------------------------------------
     * RESET WHEN SONG CHANGES
     * ---------------------------------------------------------
     */

    useEffect(() => {
        videoReadyRef.current = false;
        setVideoReady(false);

        setCurrentTime(0);
        setIsPlaying(false);

        const safeDuration = Number.isFinite(
            item.duration ?? 0,
        )
            ? item.duration ?? 0
            : 0;

        setDuration(safeDuration);

        pendingApplyRef.current = null;

        appliedPlaybackKeyRef.current = null;
    }, [item.mediaId, item.duration]);

    /*
     * ---------------------------------------------------------
     * TRACK YOUTUBE POSITION
     * ---------------------------------------------------------
     */

    useEffect(() => {
        const interval = window.setInterval(async () => {
            const player = playerRef.current;

            if (!player || !playerReadyRef.current) {
                return;
            }

            if (playerStateRef.current !== 1) {
                return;
            }

            try {
                const time = await player.getCurrentTime();

                if (playerRef.current !== player) {
                    return;
                }

                if (Number.isFinite(time) && time >= 0) {
                    setCurrentTime(time);
                }
            } catch {
                /*
                 * Ignore temporary YouTube iframe
                 * lifecycle errors.
                 */
            }
        }, 500);

        return () => {
            window.clearInterval(interval);
        };
    }, []);

    /*
     * ---------------------------------------------------------
     * APPLY SERVER PLAYBACK STATE
     * ---------------------------------------------------------
     */

    useEffect(() => {
        if (!playback || !playback.mediaId) {
            return;
        }

        if (playback.mediaId !== item.mediaId) {
            return;
        }

        const player = playerRef.current;

        if (!player || !playerReadyRef.current) {
            return;
        }

        const key = `${playback.mediaId}|${playback.isPlaying}|${playback.updatedAt}`;

        if (appliedPlaybackKeyRef.current === key) {
            return;
        }

        appliedPlaybackKeyRef.current = key;

        const targetPosition =
            computeTargetPosition(playback);

        if (videoReadyRef.current) {
            pendingApplyRef.current = null;

            applyPlaybackNow(
                player,
                targetPosition,
                playback.isPlaying,
            );
        } else {
            pendingApplyRef.current = {
                mediaId: playback.mediaId,
                targetPosition,
                isPlaying: playback.isPlaying,
            };
        }
    }, [
        playback?.mediaId,
        playback?.isPlaying,
        playback?.updatedAt,
        playerReady,
        item.mediaId,
    ]);

    /*
     * ---------------------------------------------------------
     * PLAYBACK ERROR
     * ---------------------------------------------------------
     */

    useEffect(() => {
        function handlePlaybackError(data: {
            message: string;
        }) {
            console.error(
                "Music playback error:",
                data.message,
            );
        }

        socket.on(
            "music:playback-error",
            handlePlaybackError,
        );

        return () => {
            socket.off(
                "music:playback-error",
                handlePlaybackError,
            );
        };
    }, []);

    /*
     * ---------------------------------------------------------
     * YOUTUBE ERROR
     * ---------------------------------------------------------
     */

    function handleYouTubeError(event: { data: number }) {
        console.error(
            "YouTube player error:",
            event.data,
        );
    }

    /*
     * ---------------------------------------------------------
     * YOUTUBE READY
     * ---------------------------------------------------------
     */

    function handleReady(event: {
        target: YouTubePlayerInstance;
    }) {
        const player = event.target;

        playerRef.current = player;
        playerReadyRef.current = true;

        setPlayerReady(true);

        try {
            const playerDuration =
                player.getDuration();

            if (
                Number.isFinite(playerDuration) &&
                playerDuration > 0
            ) {
                setDuration(playerDuration);
            }
        } catch {
            /*
             * Keep backend duration.
             */
        }
    }

    /*
     * ---------------------------------------------------------
     * YOUTUBE STATE CHANGE
     * ---------------------------------------------------------
     *
     * IMPORTANT:
     * Keep the correct Parameters<...>[0] syntax here.
     */

    function handleStateChange(
        event: Parameters<
            NonNullable<YouTubeProps["onStateChange"]>
        >[0],
    ) {
        const playerState = event.data;

        playerStateRef.current = playerState;

        /*
         * UNSTARTED can happen transiently.
         * Do not mark the video as unready.
         */

        if (playerState === -1) {
            return;
        }

        const isUsableState =
            playerState === 5 ||
            playerState === 3 ||
            playerState === 1 ||
            playerState === 2 ||
            playerState === 0;

        if (!isUsableState) {
            return;
        }

        const player = playerRef.current;

        const wasVideoReady =
            videoReadyRef.current;

        videoReadyRef.current = true;
        setVideoReady(true);

        if (!wasVideoReady) {
            loadedMediaIdRef.current =
                item.mediaId;

            if (
                player &&
                pendingApplyRef.current &&
                pendingApplyRef.current.mediaId ===
                    item.mediaId
            ) {
                const pending =
                    pendingApplyRef.current;

                pendingApplyRef.current = null;

                applyPlaybackNow(
                    player,
                    pending.targetPosition,
                    pending.isPlaying,
                );
            }
        }

        if (playerState === 1) {
            setIsPlaying(true);
            return;
        }

        if (playerState === 2) {
            setIsPlaying(false);
            return;
        }

        if (playerState === 0) {
            setIsPlaying(false);
            setCurrentTime(0);

            if (
                isHost &&
                loadedMediaIdRef.current ===
                    item.mediaId
            ) {
                socket.emit("music:ended");
            }
        }
    }

    /*
     * ---------------------------------------------------------
     * PLAY / PAUSE
     * ---------------------------------------------------------
     */

    function handlePlayPause() {
        if (!isHost || !playerReady) {
            return;
        }

        if (isPlaying) {
            playerRef.current?.pauseVideo();

            socket.emit("music:pause");
        } else {
            /*
             * Direct user gesture is important for
             * browser autoplay restrictions.
             */
            playerRef.current?.playVideo();

            socket.emit("music:play");
        }
    }

    /*
     * ---------------------------------------------------------
     * PREVIOUS
     * ---------------------------------------------------------
     */

    function handlePrevious() {
        if (!isHost || !playerReady) {
            return;
        }

        socket.emit("music:previous");
    }

    /*
     * ---------------------------------------------------------
     * NEXT
     * ---------------------------------------------------------
     */

    function handleNext() {
        if (!isHost || !playerReady) {
            return;
        }

        socket.emit("music:next");
    }

    /*
     * ---------------------------------------------------------
     * SEEK
     * ---------------------------------------------------------
     */

    function handleSeek(
        event: React.ChangeEvent<HTMLInputElement>,
    ) {
        if (
            !isHost ||
            !playerReady ||
            !videoReady ||
            !duration
        ) {
            return;
        }

        const time = Number(event.target.value);

        if (!Number.isFinite(time) || time < 0) {
            return;
        }

        setCurrentTime(time);

        socket.emit("music:seek", {
            position: time,
        });
    }

    /*
     * ---------------------------------------------------------
     * PLAYBACK MODE
     * ---------------------------------------------------------
     */

    function handleModeChange(
        mode:
            | "normal"
            | "repeat_one"
            | "repeat_queue"
            | "shuffle",
    ) {
        if (!isHost) {
            return;
        }

        socket.emit("music:set-mode", {
            mode,
        });
    }

    /*
     * ---------------------------------------------------------
     * FORMAT TIME
     * ---------------------------------------------------------
     */

    function formatTime(seconds: number) {
        if (
            !Number.isFinite(seconds) ||
            seconds < 0
        ) {
            return "0:00";
        }

        const minutes = Math.floor(
            seconds / 60,
        );

        const remainingSeconds =
            Math.floor(seconds % 60);

        return `${minutes}:${String(
            remainingSeconds,
        ).padStart(2, "0")}`;
    }

    /*
     * ---------------------------------------------------------
     * SAFE RANGE VALUES
     * ---------------------------------------------------------
     */

    const safeDuration =
        Number.isFinite(duration) &&
        duration > 0
            ? duration
            : 1;

    const safeCurrentTime =
        Number.isFinite(currentTime) &&
        currentTime >= 0
            ? Math.min(
                  currentTime,
                  safeDuration,
              )
            : 0;

    const progressPercent = Math.min(
        100,
        Math.max(
            0,
            (safeCurrentTime /
                safeDuration) *
                100,
        ),
    );

    const playbackMode =
        playback?.mode ?? "normal";

    const modeButtons: {
        mode:
            | "normal"
            | "repeat_one"
            | "repeat_queue"
            | "shuffle";
        label: string;
        Icon: typeof ListMusic;
    }[] = [
        {
            mode: "normal",
            label: "Normal",
            Icon: ListMusic,
        },
        {
            mode: "repeat_one",
            label: "Repeat one",
            Icon: Repeat1,
        },
        {
            mode: "repeat_queue",
            label: "Repeat queue",
            Icon: Repeat,
        },
        {
            mode: "shuffle",
            label: "Shuffle",
            Icon: Shuffle,
        },
    ];

    /*
     * ---------------------------------------------------------
     * UI
     * ---------------------------------------------------------
     */

    return (
        <div className="area-player rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-7">
            {/* Persistent YouTube player */}
            <div className="pointer-events-none fixed left-[-9999px] top-[-9999px] h-[200px] w-[200px] overflow-hidden">
                <YouTube
                    videoId={item.mediaId}
                    opts={options}
                    onReady={handleReady}
                    onStateChange={handleStateChange}
                    onError={handleYouTubeError}
                />
            </div>

            {/* Song information */}
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
                <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-xl bg-[var(--color-surface-2)] sm:h-36 sm:w-36">
                    {item.thumbnailUrl ? (
                        <img
                            src={item.thumbnailUrl}
                            alt=""
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-[var(--color-text-faint)]">
                        </div>
                    )}
                </div>

                <div className="min-w-0 flex-1 text-center sm:text-left">
                    <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-[var(--color-text-faint)] sm:justify-start">
                        Now playing from YouTube
                    </p>

                    <h2 className="mt-1 truncate font-[var(--font-display)] text-xl font-semibold text-[var(--color-text)] sm:text-2xl">
                        {item.title}
                    </h2>

                    {!isHost && (
                        <p className="mt-2 text-xs text-[var(--color-text-faint)]">
                            Only the host controls playback.
                        </p>
                    )}
                </div>
            </div>

            {/* Progress */}
            <div className="mt-6">
                <input
                    type="range"
                    min={0}
                    max={safeDuration}
                    step={0.1}
                    value={safeCurrentTime}
                    onChange={handleSeek}
                    disabled={
                        !isHost ||
                        !playerReady ||
                        !videoReady ||
                        !duration
                    }
                    aria-label="Seek"
                    style={{
                        background: `linear-gradient(to right, var(--color-accent) ${progressPercent}%, var(--color-surface-3) ${progressPercent}%)`,
                    }}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                />

                <div className="mt-2 flex justify-between text-xs text-[var(--color-text-faint)]">
                    <span>
                        {formatTime(currentTime)}
                    </span>

                    <span>
                        {formatTime(duration)}
                    </span>
                </div>
            </div>

            {/* Transport controls */}
            <div className="mt-6 flex items-center justify-center gap-4">
                <IconButton
                    variant="outline"
                    size="md"
                    onClick={handlePrevious}
                    disabled={
                        !isHost ||
                        !playerReady
                    }
                    aria-label="Previous song"
                >
                    <SkipBack size={17} />
                </IconButton>

                <IconButton
                    variant="solid"
                    size="lg"
                    onClick={handlePlayPause}
                    disabled={
                        !isHost ||
                        !playerReady
                    }
                    aria-label={
                        isPlaying
                            ? "Pause"
                            : "Play"
                    }
                >
                    {isPlaying ? (
                        <Pause
                            size={22}
                            fill="currentColor"
                        />
                    ) : (
                        <Play
                            size={22}
                            fill="currentColor"
                            className="ml-0.5"
                        />
                    )}
                </IconButton>

                <IconButton
                    variant="outline"
                    size="md"
                    onClick={handleNext}
                    disabled={
                        !isHost ||
                        !playerReady
                    }
                    aria-label="Next song"
                >
                    <SkipForward size={17} />
                </IconButton>
            </div>

            {/* Playback mode */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                {modeButtons.map(
                    ({
                        mode,
                        label,
                        Icon,
                    }) => {
                        const active =
                            playbackMode === mode;

                        return (
                            <button
                                key={mode}
                                type="button"
                                onClick={() =>
                                    handleModeChange(
                                        mode,
                                    )
                                }
                                disabled={!isHost}
                                aria-pressed={
                                    active
                                }
                                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
                                    active
                                        ? "border-[var(--color-accent-soft-strong)] bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]"
                                        : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-3)]"
                                }`}
                            >
                                <Icon size={13} />
                                {label}
                            </button>
                        );
                    },
                )}
            </div>
        </div>
    );
}