import { Router } from "express";
import { extractYouTubeVideoId } from "../utils/youtube";
import { getYouTubeVideo } from "../services/youtube";

const router = Router();

router.get("/video", async (req, res) => {
  try {
    const value =
      typeof req.query.url === "string"
        ? req.query.url
        : "";

    const videoId = extractYouTubeVideoId(value);

    if (!videoId) {
      res.status(400).json({
        error: "Invalid YouTube URL or video ID",
      });
      return;
    }

    const video = await getYouTubeVideo(videoId);

    if (!video) {
      res.status(404).json({
        error: "YouTube video not found",
      });
      return;
    }

    res.json({
      video,
    });
  } catch (error) {
    console.error("YouTube video lookup failed:", error);

    res.status(500).json({
      error: "Unable to fetch YouTube video",
    });
  }
});

export default router;