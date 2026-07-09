/**
 * ffmpeg.wasm で静止画 + 音声 → MP4
 */

let ffmpegInstance = null;
let loadPromise = null;

async function loadFfmpeg(onProgress) {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    onProgress?.("動画エンジンを読み込み中…（初回のみ30秒ほど）");
    const { FFmpeg } = await import("https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js");
    const { toBlobURL } = await import("https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js");

    const ffmpeg = new FFmpeg();
    const base = "https://cdn.jsdelivr.net/npm/@ffmpeg/core-st@0.12.10/dist/esm";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return loadPromise;
}

export async function mergeImageAndAudio(imageBlob, audioBlob, onProgress) {
  const ffmpeg = await loadFfmpeg(onProgress);
  const { fetchFile } = await import("https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js");

  const ext = audioBlob.type.includes("wav") ? "wav" : "mp3";
  await ffmpeg.writeFile("slide.png", await fetchFile(imageBlob));
  await ffmpeg.writeFile(`audio.${ext}`, await fetchFile(audioBlob));

  onProgress?.("MP4を合成中…");

  await ffmpeg.exec([
    "-loop", "1",
    "-i", "slide.png",
    "-i", `audio.${ext}`,
    "-c:v", "libx264",
    "-tune", "stillimage",
    "-c:a", "aac",
    "-b:a", "128k",
    "-pix_fmt", "yuv420p",
    "-shortest",
    "-movflags", "+faststart",
    "output.mp4",
  ]);

  const data = await ffmpeg.readFile("output.mp4");
  await ffmpeg.deleteFile("slide.png");
  await ffmpeg.deleteFile(`audio.${ext}`);
  await ffmpeg.deleteFile("output.mp4");

  return new Blob([data.buffer], { type: "video/mp4" });
}

export async function concatAudioBlobs(blobs, onProgress) {
  if (blobs.length === 1) return blobs[0];

  const ffmpeg = await loadFfmpeg(onProgress);
  const { fetchFile } = await import("https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js");

  let listContent = "";
  for (let i = 0; i < blobs.length; i++) {
    const name = `part${i}.wav`;
    await ffmpeg.writeFile(name, await fetchFile(blobs[i]));
    listContent += `file '${name}'\n`;
  }
  await ffmpeg.writeFile("list.txt", listContent);

  onProgress?.("音声を結合中…");
  await ffmpeg.exec(["-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "merged.wav"]);

  const data = await ffmpeg.readFile("merged.wav");
  for (let i = 0; i < blobs.length; i++) {
    await ffmpeg.deleteFile(`part${i}.wav`);
  }
  await ffmpeg.deleteFile("list.txt");
  await ffmpeg.deleteFile("merged.wav");

  return new Blob([data.buffer], { type: "audio/wav" });
}
