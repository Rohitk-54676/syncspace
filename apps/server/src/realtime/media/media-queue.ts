import type {
    MediaItem,
    MediaPlaybackState,
    PlaybackMode,
} from "@syncspace/shared";

export interface ShuffleState {
    order: number[];
    position: number;
}

export interface QueueNavigationResult {
    index: number | null;
    shuffleOrder: number[];
    shufflePosition: number;
}

export interface MediaQueueState {
    queue: MediaItem[];
    playback: MediaPlaybackState;
    shuffleOrder: number[];
    shufflePosition: number;
}

export function shuffleArray<T>(
    items: T[],
): T[] {
    const result = [...items];

    for (
        let index = result.length - 1;
        index > 0;
        index -= 1
    ) {
        const randomIndex = Math.floor(
            Math.random() * (index + 1),
        );

        [
            result[index],
            result[randomIndex],
        ] = [
            result[randomIndex],
            result[index],
        ];
    }

    return result;
}

export function createShuffleOrder(
    queueLength: number,
    currentIndex: number,
): ShuffleState {
    if (queueLength <= 0) {
        return {
            order: [],
            position: 0,
        };
    }

    const safeCurrentIndex =
        Math.min(
            Math.max(
                currentIndex,
                0,
            ),
            queueLength - 1,
        );

    const otherIndexes =
        Array.from(
            {
                length: queueLength,
            },
            (_, index) => index,
        ).filter(
            (index) =>
                index !== safeCurrentIndex,
        );

    const shuffledOthers =
        shuffleArray(otherIndexes);

    return {
        order: [
            safeCurrentIndex,
            ...shuffledOthers,
        ],
        position: 0,
    };
}

export function getNextIndex(
    queueLength: number,
    currentIndex: number,
    mode: PlaybackMode,
    shuffleOrder: number[],
    shufflePosition: number,
): QueueNavigationResult {
    if (queueLength === 0) {
        return {
            index: null,
            shuffleOrder: [],
            shufflePosition: 0,
        };
    }

    const safeCurrentIndex =
        Math.min(
            Math.max(
                currentIndex,
                0,
            ),
            queueLength - 1,
        );

    if (mode === "repeat_one") {
        return {
            index: safeCurrentIndex,
            shuffleOrder,
            shufflePosition,
        };
    }

    if (mode === "shuffle") {
        let order = shuffleOrder;
        let position = shufflePosition;

        if (
            order.length !== queueLength ||
            !order.includes(
                safeCurrentIndex,
            )
        ) {
            const shuffle =
                createShuffleOrder(
                    queueLength,
                    safeCurrentIndex,
                );

            order = shuffle.order;
            position = shuffle.position;
        }

        const nextPosition =
            position + 1;

        if (
            nextPosition <
            order.length
        ) {
            return {
                index:
                    order[nextPosition],
                shuffleOrder: order,
                shufflePosition:
                    nextPosition,
            };
        }

        const nextShuffle =
            createShuffleOrder(
                queueLength,
                safeCurrentIndex,
            );

        return {
            index:
                nextShuffle.order[0] ??
                null,
            shuffleOrder:
                nextShuffle.order,
            shufflePosition: 0,
        };
    }

    let nextIndex =
        safeCurrentIndex + 1;

    if (
        nextIndex >= queueLength
    ) {
        if (
            mode ===
            "repeat_queue"
        ) {
            nextIndex = 0;
        } else {
            return {
                index: null,
                shuffleOrder,
                shufflePosition,
            };
        }
    }

    return {
        index: nextIndex,
        shuffleOrder,
        shufflePosition,
    };
}

export function getPreviousIndex(
    queueLength: number,
    currentIndex: number,
    mode: PlaybackMode,
    shuffleOrder: number[],
    shufflePosition: number,
): QueueNavigationResult {
    if (queueLength === 0) {
        return {
            index: null,
            shuffleOrder: [],
            shufflePosition: 0,
        };
    }

    const safeCurrentIndex =
        Math.min(
            Math.max(
                currentIndex,
                0,
            ),
            queueLength - 1,
        );

    if (mode === "shuffle") {
        if (
            shuffleOrder.length ===
                queueLength &&
            shufflePosition > 0
        ) {
            const previousPosition =
                shufflePosition - 1;

            return {
                index:
                    shuffleOrder[
                        previousPosition
                    ] ??
                    safeCurrentIndex,
                shuffleOrder,
                shufflePosition:
                    previousPosition,
            };
        }

        return {
            index: safeCurrentIndex,
            shuffleOrder,
            shufflePosition,
        };
    }

    let previousIndex =
        safeCurrentIndex - 1;

    if (previousIndex < 0) {
        if (
            mode ===
            "repeat_queue"
        ) {
            previousIndex =
                queueLength - 1;
        } else {
            previousIndex = 0;
        }
    }

    return {
        index: previousIndex,
        shuffleOrder,
        shufflePosition,
    };
}

export function rebuildShuffleAfterQueueChange(
    room: MediaQueueState,
): void {
    if (
        room.playback.mode !==
        "shuffle"
    ) {
        room.shuffleOrder = [];
        room.shufflePosition = 0;

        return;
    }

    if (
        room.playback.currentIndex ===
        null
    ) {
        room.shuffleOrder = [];
        room.shufflePosition = 0;

        return;
    }

    const shuffle =
        createShuffleOrder(
            room.queue.length,
            room.playback.currentIndex,
        );

    room.shuffleOrder =
        shuffle.order;

    room.shufflePosition =
        shuffle.position;
}