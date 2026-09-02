import type { MediaItem } from "@syncspace/shared";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function getYouTubeVideo(
  url: string,
): Promise<MediaItem> {
  const params = new URLSearchParams({
    url,
  });

  const response = await fetch(
    `${API_URL}/api/youtube/video?${params.toString()}`,
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ?? "Unable to fetch YouTube video",
    );
  }

  return data.video as MediaItem;
}