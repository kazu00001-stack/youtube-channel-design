/**
 * サーバー側 ffmpeg — 音声結合
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

  const { parts } = req.body || {};
  if (!Array.isArray(parts) || parts.length === 0) {
    return res.status(400).json({ error: "parts 配列が必要です" });
  }

  const ffmpeg = ffmpegStatic;
  if (!ffmpeg) {
    return res.status(500).json({ error: "ffmpeg が利用できません" });
  }

  const dir = await mkdtemp(join(tmpdir(), "yt-audio-"));
  try {
    let listContent = "";
    for (let i = 0; i < parts.length; i++) {
      const name = `part${i}.wav`;
      await writeFile(join(dir, name), Buffer.from(parts[i], "base64"));
      listContent += `file '${name}'\n`;
    }
    await writeFile(join(dir, "list.txt"), listContent);
    const outPath = join(dir, "merged.wav");

    await exec(
      ffmpeg,
      ["-f", "concat", "-safe", "0", "-i", "list.txt", "-c:a", "pcm_s16le", outPath],
      { timeout: 120000, cwd: dir }
    );

    const buf = await readFile(outPath);
    return res.status(200).json({
      mimeType: "audio/wav",
      data: buf.toString("base64"),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "音声結合に失敗しました" });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
