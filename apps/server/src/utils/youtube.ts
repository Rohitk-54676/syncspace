export function extractYouTubeVideoId(
  value: string,
): string | null {
  const input = value.trim();

  if (!input) {
    return null;
  }

  // Direct YouTube video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return input;
  }

  try {
    const url = new URL(input);

    // youtube.com/watch?v=VIDEO_ID
    if (
      url.hostname === "www.youtube.com" ||
      url.hostname === "youtube.com" ||
      url.hostname === "m.youtube.com"
    ) {
      const videoId = url.searchParams.get("v");

      if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return videoId;
      }

      // youtube.com/shorts/VIDEO_ID
      const shortsMatch = url.pathname.match(
        /^\/shorts\/([a-zA-Z0-9_-]{11})/,
      );

      if (shortsMatch) {
        return shortsMatch[1];
      }

      // youtube.com/embed/VIDEO_ID
      const embedMatch = url.pathname.match(
        /^\/embed\/([a-zA-Z0-9_-]{11})/,
      );

      if (embedMatch) {
        return embedMatch[1];
      }
    }

    // youtu.be/VIDEO_ID
    if (url.hostname === "youtu.be") {
      const videoId = url.pathname.slice(1);

      if (/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return videoId;
      }
    }
  } catch {
    return null;
  }

  return null;
}