"use client";

import YouTube, { type YouTubeProps } from "react-youtube";

interface YouTubePlayerProps {
  videoId: string;
}

export default function YouTubePlayer({ videoId }: YouTubePlayerProps) {
  const options: YouTubeProps["opts"] = {
    width: "100%",
    height: "390",
    playerVars: {
      autoplay: 0,
      controls: 1,
      rel: 0,
    },
  };

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-black">
      <YouTube
        videoId={videoId}
        opts={options}
        className="w-full"
        iframeClassName="w-full"
      />
    </div>
  );
}