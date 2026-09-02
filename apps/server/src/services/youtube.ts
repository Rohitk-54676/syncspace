import type { MediaItem } from "@syncspace/shared";

const YOUTUBE_API_URL =
  "https://www.googleapis.com/youtube/v3/videos";

function parseYouTubeDuration(duration: string): number | null {
  const match = duration.match(
    /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/,
  );

  if (!match) {
    return null;
  }

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);

  return hours * 3600 + minutes * 60 + seconds;
}

export async function getYouTubeVideo(
  videoId: string,
): Promise<MediaItem | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY is not configured");
  }

  const url = new URL(YOUTUBE_API_URL);

  url.searchParams.set("part", "snippet,contentDetails");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url);

  if (!response.ok) {
    console.error(
      "YouTube API request failed:",
      response.status,
    );

    throw new Error("YouTube API request failed");
  }

  const data = (await response.json()) as {
    items?: Array<{
      id: string;
      snippet?: {
        title?: string;
        thumbnails?: {
          high?: {
            url?: string;
          };
          medium?: {
            url?: string;
          };
          default?: {
            url?: string;
          };
        };
      };
      contentDetails?: {
        duration?: string;
      };
    }>;
  };

  const video = data.items?.[0];

  if (!video) {
    return null;
  }

  const title = video.snippet?.title;

  if (!title) {
    return null;
  }

  const thumbnailUrl =
    video.snippet?.thumbnails?.high?.url ??
    video.snippet?.thumbnails?.medium?.url ??
    video.snippet?.thumbnails?.default?.url ??
    null;

  const duration = video.contentDetails?.duration
    ? parseYouTubeDuration(video.contentDetails.duration)
    : null;

  return {
    mediaId: video.id,
    mediaType: "music",
    title,
    duration,
    thumbnailUrl,
  };
}