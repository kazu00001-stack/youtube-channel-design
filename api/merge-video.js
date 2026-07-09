/**
 * サーバー側 ffmpeg — 静止画 + 音声 → MP4
 */
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import ffmpegStatic from "ffmpeg-static";

const exec = promisify(execFile);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { imageBase64, audioBase64, audioMime } = req.body || {};
  if (!imageBase64 || !audioBase64) {
    return res.status(400).json({ error: "imageBase64 と audioBase64 が必要です" });
  }

  const ffmpeg = ffmpegStatic;
  if (!ffmpeg) {
    return res.status(500).json({ error: "ffmpeg が利用できません" });
  }

  const dir = await mkdtemp(join(tmpdir(), "yt-video-"));
  try {
    const imgPath = join(dir, "slide.png");
    const audExt = String(audioMime || "").includes("wav") ? "wav" : "mp3";
    const audPath = join(dir, `audio.${audExt}`);
    const outPath = join(dir, "output.mp4");

    await writeFile(imgPath, Buffer.from(imageBase64, "base64"));
    await writeFile(audPath, Buffer.from(audioBase64, "base64"));

    await exec(
      ffmpeg,
      [
        "-loop", "1",
        "-i", imgPath,
        "-i", audPath,
        "-c:v", "libx264",
        "-tune", "stillimage",
        "-c:a", "aac",
        "-b:a", "128k",
        "-pix_fmt", "yuv420p",
        "-shortest",
        "-movflags", "+faststart",
        outPath,
      ],
      { timeout: 180000, cwd: dir }
    );

    const buf = await readFile(outPath);
    return res.status(200).json({
      mimeType: "video/mp4",
      data: buf.toString("base64"),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "MP4合成に失敗しました" });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
