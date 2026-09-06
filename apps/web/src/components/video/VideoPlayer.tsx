"use client";

import { useEffect, useRef, useState } from "react";
import type {
    MediaItem,
    MediaPlaybackState,
    PlaybackMode,
} from "@syncspace/shared";

interface VideoPlayerProps {
    media: MediaItem | null;
    playback: MediaPlaybackState | null;
    isHost: boolean;

    onPlay: () => void;
    onPause: () => void;
    onSeek: (position: number) => void;
    onEnded: () => void;

    onNext: () => void;
    onPrevious: () => void;
    onSetMode: (mode: PlaybackMode) => void;
}

interface YouTubePlayer {
    destroy: () => void;
    playVideo: () => void;
    pauseVideo: () => void;
    seekTo: (
        seconds: number,
        allowSeekAhead: boolean,
    ) => void;
    getCurrentTime: () => number;
    getPlayerState: () => number;
}

interface YouTubePlayerConstructor {
    new (
        element: HTMLElement,
        options: {
            videoId: string;
            playerVars?: {
                autoplay?: number;
                controls?: number;
                rel?: number;
                modestbranding?: number;
                playsinline?: number;
            };
            events?: {
                onReady?: () => void;
                onStateChange?: (event: {
                    data: number;
                }) => void;
            };
        },
    ): YouTubePlayer;
}

declare global {
    interface Window {
        YT?: {
            Player: YouTubePlayerConstructor;
            PlayerState: {
                ENDED: number;
                PLAYING: number;
                PAUSED: number;
                BUFFERING: number;
            };
        };
        onYouTubeIframeAPIReady?: () => void;
    }
}

const PLAYBACK_MODES: {
    value: PlaybackMode;
    label: string;
}[] = [
    {
        value: "normal",
        label: "Normal",
    },
    {
        value: "repeat_one",
        label: "Repeat One",
    },
    {
        value: "repeat_queue",
        label: "Repeat Queue",
    },
    {
        value: "shuffle",
        label: "Shuffle",
    },
];

/*
 * How often we poll for slow position drift (participants only)
 * and native host-seek detection. This interval NEVER decides
 * play/pause state (that's fully event-driven, see the "apply
 * server playback" effect below).
 */
const SYNC_INTERVAL_MS = 500;
const SEEK_THRESHOLD_SECONDS = 1.25;

/*
 * Safety net only. If a participant asks to resume and the server
 * rejects the request (e.g. the room is actually stopped), no
 * "video:playback-updated" answer will ever arrive. Without this,
 * the participant would be stuck in "resyncing" forever. This is
 * NOT used as a synchronization mechanism — resync is answered by
 * a real event the overwhelming majority of the time; this only
 * guards the rejection edge case.
 */
const RESYNC_FALLBACK_MS = 4000;

type ClientSyncState =
    | "following"
    | "locally_paused"
    | "resyncing";

function extractYouTubeId(
    mediaId: string,
): string {
    return mediaId;
}

function isUsablePlayer(
    player: YouTubePlayer | null,
): player is YouTubePlayer {
    return (
        !!player &&
        typeof player.getCurrentTime ===
            "function" &&
        typeof player.seekTo ===
            "function" &&
        typeof player.playVideo ===
            "function" &&
        typeof player.pauseVideo ===
            "function"
    );
}

function getAuthoritativePosition(
    playback: MediaPlaybackState,
): number {
    if (!playback.isPlaying) {
        return Math.max(
            0,
            playback.position,
        );
    }

    return Math.max(
        0,
        playback.position +
            Math.max(
                0,
                (Date.now() -
                    playback.updatedAt) /
                    1000,
            ),
    );
}

export function VideoPlayer({
    media,
    playback,
    isHost,
    onPlay,
    onPause,
    onSeek,
    onEnded,
    onNext,
    onPrevious,
    onSetMode,
}: VideoPlayerProps) {
    const containerRef =
        useRef<HTMLDivElement | null>(
            null,
        );

    const playerRef =
        useRef<YouTubePlayer | null>(
            null,
        );

    const playbackRef =
        useRef<MediaPlaybackState | null>(
            playback,
        );

    const mediaRef =
        useRef<MediaItem | null>(
            media,
        );

    const isHostRef =
        useRef(isHost);

    const onPlayRef =
        useRef(onPlay);

    const onPauseRef =
        useRef(onPause);

    const onSeekRef =
        useRef(onSeek);

    const onEndedRef =
        useRef(onEnded);

    /*
     * ---------------------------------------------------------
     * SYNCHRONIZATION STATE MACHINE (participant-only concept)
     * ---------------------------------------------------------
     *
     * "following"       -> local player tracks the authoritative
     *                       room timeline (default state).
     * "locally_paused"   -> participant paused their own view;
     *                       the room continues elsewhere.
     * "resyncing"        -> participant asked to resume; we are
     *                       waiting for the authoritative playback
     *                       update that answers this request.
     *
     * The host is always conceptually "following" — the host
     * drives the timeline, so these paused/resyncing states never
     * apply to the host branch of the code.
     */
    const clientSyncStateRef =
        useRef<ClientSyncState>(
            "following",
        );

    const resyncStartedAtRef =
        useRef<number | null>(null);

    /*
     * ---------------------------------------------------------
     * WHY THERE IS NO "pendingCommand kind+generation" TRACKING
     * ANYMORE
     * ---------------------------------------------------------
     *
     * The previous design tracked "we just issued command X, the
     * next matching onStateChange event is a confirmation" via a
     * pendingCommandRef object. That has a structural weakness: if
     * a confirming event is ever missed for ANY reason (e.g. the
     * player was already in that state and YouTube doesn't fire a
     * transition event), the ref gets stuck forever, silently
     * disabling logic gated behind it.
     *
     * We now distinguish "was this event caused by our own action"
     * from "is this a genuine user action" by comparing the event
     * against the AUTHORITATIVE TRUTH we already have
     * (`playbackRef.current.isPlaying`) instead of trying to
     * predict/track intent:
     *   - A PLAYING event while `playbackRef.current.isPlaying` is
     *     already true is just our own action settling — ignore.
     *   - A PLAYING event while it's false is a genuine user
     *     action (native host control, or a quirky auto-resume for
     *     a participant) — act on it.
     *   - Same logic, inverted, for PAUSED.
     * This is robust regardless of exact YouTube event timing/
     * ordering, since it never depends on a flag getting cleared
     * correctly.
     *
     * The ONE place we still need an explicit "this pause was ours"
     * signal is to know when it's safe to flush a DEFERRED seek
     * (see `deferredSeekPositionRef` below) — that's the sole
     * purpose of `awaitingProgrammaticPauseRef`.
     */
    const awaitingProgrammaticPauseRef =
        useRef(false);

    /*
     * A position to seek to ONCE a pending pause is confirmed.
     *
     * seekTo() and pauseVideo() must never be issued back-to-back
     * when the target state is "paused" — YouTube's IFrame API has
     * a well-known quirk where seeking a player that is
     * mid-transition into paused can cause it to silently resume
     * playing once the seek's internal buffering settles. We pause
     * first and defer any seek until PAUSED is actually confirmed.
     */
    const deferredSeekPositionRef =
        useRef<number | null>(null);

    /*
     * Tracks the latest CONFIRMED local player state (only updated
     * from real onStateChange events, so this reflects what the
     * player has actually settled into, not what we asked for).
     */
    const playerStateRef =
        useRef<number | null>(null);

    /*
     * Debounces repeated host-seek reports for the same detected
     * jump. Reset to null once drift resolves, so a later genuine
     * seek is always freshly detected.
     */
    const lastReportedSeekRef =
        useRef<number | null>(null);

    /*
     * Protects against callbacks from an old YouTube player
     * instance.
     */
    const playerGenerationRef =
        useRef(0);

    const [apiReady, setApiReady] =
        useState(false);

    const [localPaused, setLocalPaused] =
        useState(false);

    useEffect(() => {
        playbackRef.current =
            playback;
    }, [playback]);

    useEffect(() => {
        mediaRef.current =
            media;
    }, [media]);

    useEffect(() => {
        isHostRef.current =
            isHost;
    }, [isHost]);

    useEffect(() => {
        onPlayRef.current =
            onPlay;
    }, [onPlay]);

    useEffect(() => {
        onPauseRef.current =
            onPause;
    }, [onPause]);

    useEffect(() => {
        onSeekRef.current =
            onSeek;
    }, [onSeek]);

    useEffect(() => {
        onEndedRef.current =
            onEnded;
    }, [onEnded]);

    /*
     * ---------------------------------------------------------
     * APPLY AUTHORITATIVE STATE TO THE LOCAL PLAYER
     * ---------------------------------------------------------
     *
     * Single choke point used by the newly-created player
     * (onReady), every subsequent server update (the "apply server
     * playback" effect), and a participant's own local pause.
     *
     * - Target PLAYING: seek (if requested) THEN play. Safe — we
     *   WANT the player moving afterward, so there is no risk of
     *   an unwanted silent resume.
     * - Target PAUSED, already settled paused: safe to seek
     *   immediately — the player isn't mid-transition.
     * - Target PAUSED, not yet paused: pause FIRST, and stash the
     *   seek target in `deferredSeekPositionRef`. The seek is
     *   performed only once onStateChange confirms PAUSED.
     */
    function applyAuthoritativeState(
        player: YouTubePlayer,
        targetPosition: number,
        shouldPlay: boolean,
        forceSeek: boolean,
    ) {
        if (shouldPlay) {
            try {
                if (forceSeek) {
                    player.seekTo(
                        targetPosition,
                        true,
                    );
                }

                player.playVideo();
            } catch {
                // Ignore; a later update will retry.
            }

            return;
        }

        if (
            playerStateRef.current ===
            window.YT?.PlayerState.PAUSED
        ) {
            /*
             * Already settled paused — no transition in flight,
             * so seeking now is safe.
             */
            if (forceSeek) {
                try {
                    player.seekTo(
                        targetPosition,
                        true,
                    );
                } catch {
                    // Ignore; not critical while paused.
                }
            }

            return;
        }

        awaitingProgrammaticPauseRef.current =
            true;

        deferredSeekPositionRef.current =
            forceSeek
                ? targetPosition
                : null;

        try {
            player.pauseVideo();
        } catch {
            awaitingProgrammaticPauseRef.current =
                false;

            deferredSeekPositionRef.current =
                null;
        }
    }

    /*
     * Load the YouTube IFrame API once.
     */
    useEffect(() => {
        if (
            typeof window === "undefined"
        ) {
            return;
        }

        if (window.YT?.Player) {
            setApiReady(true);
            return;
        }

        const existingScript =
            document.querySelector(
                'script[src="https://www.youtube.com/iframe_api"]',
            );

        const previousCallback =
            window.onYouTubeIframeAPIReady;

        window.onYouTubeIframeAPIReady =
            () => {
                previousCallback?.();
                setApiReady(true);
            };

        if (!existingScript) {
            const script =
                document.createElement(
                    "script",
                );

            script.src =
                "https://www.youtube.com/iframe_api";

            script.async = true;

            document.head.appendChild(
                script,
            );
        }

        return () => {
            window.onYouTubeIframeAPIReady =
                previousCallback;
        };
    }, []);

    /*
     * ---------------------------------------------------------
     * CREATE / DESTROY THE YOUTUBE PLAYER
     * ---------------------------------------------------------
     *
     * Runs when the media changes, OR when host status changes.
     * Host status is included because `controls` is a player-wide
     * setting (participants get controls:0 — no native seek bar
     * or play/pause — hosts get controls:1). A host-transfer mid
     * session is rare enough that a brief player rebuild is an
     * acceptable, simple way to apply the correct controls.
     * ---------------------------------------------------------
     */

    useEffect(() => {
        if (
            !apiReady ||
            !media ||
            !containerRef.current ||
            !window.YT?.Player
        ) {
            return;
        }

        const videoId =
            extractYouTubeId(
                media.mediaId,
            );

        playerGenerationRef.current +=
            1;

        const generation =
            playerGenerationRef.current;

        const previousPlayer =
            playerRef.current;

        playerRef.current = null;

        if (previousPlayer) {
            try {
                previousPlayer.destroy();
            } catch {
                // Ignore cleanup errors.
            }
        }

        containerRef.current.innerHTML =
            "";

        const playerElement =
            document.createElement(
                "div",
            );

        playerElement.className =
            "h-full w-full";

        containerRef.current.appendChild(
            playerElement,
        );

        /*
         * A new media item always resets the local synchronization
         * state — the previous song's local pause has no meaning
         * for a new song.
         */
        clientSyncStateRef.current =
            "following";

        resyncStartedAtRef.current =
            null;

        awaitingProgrammaticPauseRef.current =
            false;

        deferredSeekPositionRef.current =
            null;

        setLocalPaused(false);

        playerStateRef.current =
            null;

        lastReportedSeekRef.current =
            null;

        const player =
            new window.YT.Player(
                playerElement,
                {
                    videoId,
                    playerVars: {
                        autoplay: 0,
                        /*
                         * Only the host gets native YouTube
                         * controls (including the seek bar).
                         * Participants get a minimal custom
                         * play/pause-only control instead (see
                         * JSX below) so they cannot perform a
                         * shared seek through the YouTube UI.
                         */
                        controls: isHost
                            ? 1
                            : 0,
                        rel: 0,
                        modestbranding: 1,
                        playsinline: 1,
                    },

                    events: {
                        onReady: () => {
                            if (
                                generation !==
                                playerGenerationRef.current
                            ) {
                                try {
                                    player.destroy();
                                } catch {
                                    // Ignore stale player cleanup errors.
                                }

                                return;
                            }

                            playerRef.current =
                                player;

                            const currentPlayback =
                                playbackRef.current;

                            if (
                                !currentPlayback ||
                                currentPlayback.mediaId !==
                                    videoId
                            ) {
                                return;
                            }

                            if (
                                !isUsablePlayer(
                                    player,
                                )
                            ) {
                                return;
                            }

                            clientSyncStateRef.current =
                                "following";

                            resyncStartedAtRef.current =
                                null;

                            setLocalPaused(
                                false,
                            );

                            const targetPosition =
                                getAuthoritativePosition(
                                    currentPlayback,
                                );

                            applyAuthoritativeState(
                                player,
                                targetPosition,
                                currentPlayback.isPlaying,
                                targetPosition >
                                    0,
                            );
                        },

                        onStateChange: (
                            event,
                        ) => {
                            if (
                                generation !==
                                playerGenerationRef.current
                            ) {
                                return;
                            }

                            const YT =
                                window.YT;

                            if (!YT) {
                                return;
                            }

                            /*
                             * Only update the CONFIRMED state
                             * tracker for states we actually
                             * handle below (PAUSED/PLAYING/ENDED).
                             * Transient states like BUFFERING or
                             * UNSTARTED are intentionally NOT
                             * recorded here, so a brief buffering
                             * blip mid-playback can't be mistaken
                             * for "not yet playing" by the drift/
                             * seek-detection interval below.
                             */

                            /*
                             * -----------------------------------
                             * PAUSED
                             * -----------------------------------
                             */
                            if (
                                event.data ===
                                YT
                                    .PlayerState
                                    .PAUSED
                            ) {
                                playerStateRef.current =
                                    event.data;

                                if (
                                    awaitingProgrammaticPauseRef.current
                                ) {
                                    /*
                                     * Confirmed: this is our own
                                     * pause settling, not a user
                                     * action. The player is now
                                     * genuinely paused (no
                                     * transition in flight), so any
                                     * deferred position correction
                                     * can safely be applied now.
                                     */
                                    awaitingProgrammaticPauseRef.current =
                                        false;

                                    const deferredSeek =
                                        deferredSeekPositionRef.current;

                                    deferredSeekPositionRef.current =
                                        null;

                                    if (
                                        deferredSeek !==
                                        null
                                    ) {
                                        try {
                                            player.seekTo(
                                                deferredSeek,
                                                true,
                                            );
                                        } catch {
                                            // Ignore; not critical while paused.
                                        }
                                    }

                                    return;
                                }

                                /*
                                 * Not something we asked for.
                                 * Compare against the authoritative
                                 * truth to decide if this is a
                                 * genuine user action.
                                 */
                                if (
                                    !isHostRef.current
                                ) {
                                    if (
                                        playbackRef.current
                                            ?.isPlaying
                                    ) {
                                        /*
                                         * Room still says playing,
                                         * but this participant's
                                         * view just paused — their
                                         * own local pause action.
                                         */
                                        clientSyncStateRef.current =
                                            "locally_paused";

                                        resyncStartedAtRef.current =
                                            null;

                                        setLocalPaused(
                                            true,
                                        );
                                    }

                                    return;
                                }

                                /*
                                 * HOST: room still says playing,
                                 * but the local player just paused
                                 * (native control click) — genuine
                                 * shared pause.
                                 */
                                if (
                                    playbackRef.current
                                        ?.isPlaying
                                ) {
                                    setLocalPaused(
                                        false,
                                    );

                                    onPauseRef.current();
                                }

                                return;
                            }

                            /*
                             * -----------------------------------
                             * PLAYING
                             * -----------------------------------
                             */
                            if (
                                event.data ===
                                YT
                                    .PlayerState
                                    .PLAYING
                            ) {
                                playerStateRef.current =
                                    event.data;

                                if (
                                    !isHostRef.current
                                ) {
                                    if (
                                        !playbackRef.current
                                            ?.isPlaying
                                    ) {
                                        /*
                                         * The room does not (yet)
                                         * consider this participant
                                         * playing, but the local
                                         * video started anyway
                                         * (stale-position resume
                                         * attempt, or a native-
                                         * player quirk). Force back
                                         * to paused and (re)request
                                         * the authoritative state.
                                         */
                                        awaitingProgrammaticPauseRef.current =
                                            true;

                                        deferredSeekPositionRef.current =
                                            null;

                                        try {
                                            player.pauseVideo();
                                        } catch {
                                            awaitingProgrammaticPauseRef.current =
                                                false;
                                        }

                                        if (
                                            clientSyncStateRef.current !==
                                            "resyncing"
                                        ) {
                                            clientSyncStateRef.current =
                                                "resyncing";

                                            resyncStartedAtRef.current =
                                                Date.now();

                                            setLocalPaused(
                                                false,
                                            );

                                            onPlayRef.current();
                                        }
                                    }

                                    return;
                                }

                                /*
                                 * HOST: if the room doesn't yet
                                 * consider itself playing, this is
                                 * a genuine Play action (native
                                 * control, or starting a stopped
                                 * room). If it's already true, this
                                 * PLAYING event is just our own
                                 * action settling — nothing to do.
                                 */
                                if (
                                    !playbackRef.current
                                        ?.isPlaying
                                ) {
                                    onPlayRef.current();
                                }

                                return;
                            }

                            /*
                             * -----------------------------------
                             * ENDED
                             * -----------------------------------
                             */
                            if (
                                event.data ===
                                YT
                                    .PlayerState
                                    .ENDED
                            ) {
                                playerStateRef.current =
                                    event.data;

                                clientSyncStateRef.current =
                                    "following";

                                resyncStartedAtRef.current =
                                    null;

                                setLocalPaused(
                                    false,
                                );

                                if (
                                    isHostRef.current
                                ) {
                                    onEndedRef.current();
                                }
                            }
                        },
                    },
                },
            );

        if (
            isUsablePlayer(player) &&
            generation ===
                playerGenerationRef.current
        ) {
            playerRef.current =
                player;
        }

        return () => {
            if (
                generation !==
                playerGenerationRef.current
            ) {
                return;
            }

            playerGenerationRef.current +=
                1;

            const activePlayer =
                playerRef.current;

            playerRef.current = null;

            if (activePlayer) {
                try {
                    activePlayer.destroy();
                } catch {
                    // Ignore cleanup errors.
                }
            }
        };
    }, [apiReady, media?.mediaId, isHost]);

    /*
     * ---------------------------------------------------------
     * APPLY SERVER PLAYBACK STATE — event-driven
     * ---------------------------------------------------------
     *
     * Fires the moment a real server broadcast arrives. Depends on
     * the `playback` OBJECT ITSELF (not destructured primitives) —
     * `useRoomSocket` only calls setPlayback() in response to an
     * actual incoming socket message, so a new reference always
     * means a real event occurred, including a targeted resync
     * answer that happens to be numerically identical to what the
     * client already had.
     * ---------------------------------------------------------
     */

    useEffect(() => {
        if (
            !playback ||
            !media ||
            playback.mediaId !==
                media.mediaId
        ) {
            return;
        }

        const player =
            playerRef.current;

        if (
            !isUsablePlayer(player)
        ) {
            return;
        }

        /*
         * A participant who intentionally paused locally stays
         * paused. Only their own explicit resume action (handled
         * in the participant control below) can bring them back.
         */
        if (
            !isHostRef.current &&
            clientSyncStateRef.current ===
                "locally_paused"
        ) {
            return;
        }

        const wasResyncing =
            clientSyncStateRef.current ===
            "resyncing";

        const targetPosition =
            getAuthoritativePosition(
                playback,
            );

        let localPosition: number | null =
            null;

        try {
            localPosition =
                player.getCurrentTime();
        } catch {
            localPosition = null;
        }

        const drift =
            localPosition === null
                ? Number.POSITIVE_INFINITY
                : Math.abs(
                      localPosition -
                          targetPosition,
                  );

        /*
         * A resync answer always seeks (the participant was
         * sitting at a stale position). Otherwise, only seek
         * when drift is meaningful.
         */
        const shouldSeek =
            wasResyncing ||
            drift >
                SEEK_THRESHOLD_SECONDS;

        applyAuthoritativeState(
            player,
            targetPosition,
            playback.isPlaying,
            shouldSeek,
        );

        clientSyncStateRef.current =
            "following";

        resyncStartedAtRef.current =
            null;

        setLocalPaused(false);
    }, [playback, media?.mediaId]);

    /*
     * ---------------------------------------------------------
     * SLOW DRIFT CORRECTION (participants) + HOST SEEK DETECTION
     * ---------------------------------------------------------
     *
     * CRITICAL: drift-correction-by-seeking must NEVER run for the
     * host. For the host, the local player IS the source of truth
     * — if it diverges from what the server currently believes,
     * that means the host just seeked, and it must be REPORTED
     * upward, never silently overwritten locally. Applying
     * drift-correction to the host was what undid the host's own
     * manual seeks (Bug 2), and could also race a fresh Resume's
     * playVideo() call before it had visually taken effect,
     * derailing it (Bug 1's intermittent failures).
     *
     * Both branches are gated on `playerStateRef.current === PLAYING`
     * — a real, confirmed signal (not a timer) — so neither one
     * runs while the player is mid-transition between paused and
     * playing. This is what makes seek-detection accurate for
     * small movements too (previously only large jumps registered)
     * and prevents a resume-in-progress lag from being misread as
     * a seek.
     * ---------------------------------------------------------
     */

    useEffect(() => {
        const interval =
            window.setInterval(() => {
                const player =
                    playerRef.current;

                const currentPlayback =
                    playbackRef.current;

                const currentMedia =
                    mediaRef.current;

                if (
                    !isUsablePlayer(
                        player,
                    ) ||
                    !currentPlayback ||
                    !currentMedia
                ) {
                    return;
                }

                if (
                    currentPlayback.mediaId !==
                    currentMedia.mediaId
                ) {
                    return;
                }

                if (
                    !currentPlayback.isPlaying
                ) {
                    return;
                }

                if (
                    playerStateRef.current !==
                    window.YT?.PlayerState
                        .PLAYING
                ) {
                    /*
                     * Not yet confirmed playing (still buffering,
                     * or mid-transition from a recent play/pause).
                     * Comparing drift right now would be comparing
                     * against a moving target during startup lag,
                     * not a genuine divergence — skip this tick.
                     */
                    return;
                }

                if (
                    clientSyncStateRef.current !==
                    "following"
                ) {
                    return;
                }

                let localPosition = 0;

                try {
                    localPosition =
                        player.getCurrentTime();
                } catch {
                    return;
                }

                if (
                    !Number.isFinite(
                        localPosition,
                    )
                ) {
                    return;
                }

                const targetPosition =
                    getAuthoritativePosition(
                        currentPlayback,
                    );

                const drift =
                    Math.abs(
                        localPosition -
                            targetPosition,
                    );

                if (
                    !isHostRef.current
                ) {
                    /*
                     * PARTICIPANT: gently correct local drift to
                     * follow the host's timeline.
                     */
                    if (
                        drift >
                        SEEK_THRESHOLD_SECONDS
                    ) {
                        try {
                            player.seekTo(
                                targetPosition,
                                true,
                            );
                        } catch {
                            // Ignore; will retry next tick.
                        }
                    }

                    return;
                }

                /*
                 * HOST: never self-correct. A meaningful, sustained
                 * divergence while genuinely playing means the host
                 * just performed a native seek — report it upward.
                 */
                if (
                    drift >
                    SEEK_THRESHOLD_SECONDS
                ) {
                    if (
                        lastReportedSeekRef.current ===
                            null ||
                        Math.abs(
                            localPosition -
                                lastReportedSeekRef.current,
                        ) > 1
                    ) {
                        lastReportedSeekRef.current =
                            localPosition;

                        onSeekRef.current(
                            localPosition,
                        );
                    }
                } else {
                    /*
                     * Drift resolved (e.g. the server's broadcast
                     * caught up) — reset the debounce so a future
                     * genuine seek is detected fresh.
                     */
                    lastReportedSeekRef.current =
                        null;
                }
            }, SYNC_INTERVAL_MS);

        return () => {
            window.clearInterval(
                interval,
            );
        };
    }, []);

    /*
     * ---------------------------------------------------------
     * RESYNC SAFETY FALLBACK
     * ---------------------------------------------------------
     *
     * Only matters if the server rejected the resume request
     * (e.g. the room was actually stopped) — in that case no
     * "video:playback-updated" answer will ever arrive, and
     * without this the participant would be stuck silently
     * paused-but-marked-resyncing forever.
     * ---------------------------------------------------------
     */

    useEffect(() => {
        const interval =
            window.setInterval(() => {
                if (
                    clientSyncStateRef.current ===
                        "resyncing" &&
                    resyncStartedAtRef.current &&
                    Date.now() -
                        resyncStartedAtRef.current >
                        RESYNC_FALLBACK_MS
                ) {
                    clientSyncStateRef.current =
                        "locally_paused";

                    resyncStartedAtRef.current =
                        null;

                    setLocalPaused(true);
                }
            }, 1000);

        return () => {
            window.clearInterval(
                interval,
            );
        };
    }, []);

    /*
     * ---------------------------------------------------------
     * PARTICIPANT LOCAL PAUSE / RESUME
     * ---------------------------------------------------------
     */

    function handleParticipantTogglePause() {
        const player =
            playerRef.current;

        if (!isUsablePlayer(player)) {
            return;
        }

        if (localPaused) {
            /*
             * Resume: do NOT continue from the stale local
             * position. Ask the server for the authoritative
             * state and wait for it — the "apply server
             * playback" effect will seek + play exactly once,
             * the moment it arrives.
             */
            clientSyncStateRef.current =
                "resyncing";

            resyncStartedAtRef.current =
                Date.now();

            setLocalPaused(false);

            onPlay();

            return;
        }

        applyAuthoritativeState(
            player,
            0,
            false,
            false,
        );

        clientSyncStateRef.current =
            "locally_paused";

        resyncStartedAtRef.current =
            null;

        setLocalPaused(true);
    }

    if (!media) {
        return (
            <div className="flex aspect-video items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-muted)]">
                No video selected
            </div>
        );
    }

    const currentMode =
        playback?.mode ?? "normal";

    return (
        <div className="space-y-3">
            <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-black">
                <div
                    ref={containerRef}
                    className="aspect-video w-full"
                />
            </div>

            {isHost && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={
                                onPrevious
                            }
                            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm transition hover:bg-[var(--color-surface-hover)]"
                        >
                            Previous
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                if (
                                    playback?.isPlaying
                                ) {
                                    onPause();
                                } else {
                                    onPlay();
                                }
                            }}
                            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium transition hover:bg-[var(--color-surface-hover)]"
                        >
                            {playback?.isPlaying
                                ? "Pause"
                                : "Play"}
                        </button>

                        <button
                            type="button"
                            onClick={
                                onNext
                            }
                            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm transition hover:bg-[var(--color-surface-hover)]"
                        >
                            Next
                        </button>
                    </div>

                    <label className="flex items-center gap-2 text-sm">
                        <span className="text-[var(--color-text-muted)]">
                            Mode
                        </span>

                        <select
                            value={
                                currentMode
                            }
                            onChange={(
                                event,
                            ) => {
                                onSetMode(
                                    event.target
                                        .value as PlaybackMode,
                                );
                            }}
                            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none"
                        >
                            {PLAYBACK_MODES.map(
                                (
                                    mode,
                                ) => (
                                    <option
                                        key={
                                            mode.value
                                        }
                                        value={
                                            mode.value
                                        }
                                    >
                                        {
                                            mode.label
                                        }
                                    </option>
                                ),
                            )}
                        </select>
                    </label>
                </div>
            )}

            {!isHost && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                    <button
                        type="button"
                        onClick={
                            handleParticipantTogglePause
                        }
                        className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium transition hover:bg-[var(--color-surface-hover)]"
                    >
                        {localPaused
                            ? "Resume"
                            : "Pause (just for you)"}
                    </button>

                    <span className="text-xs text-[var(--color-text-muted)]">
                        Only the host controls
                        playback for everyone.
                    </span>
                </div>
            )}
        </div>
    );
}