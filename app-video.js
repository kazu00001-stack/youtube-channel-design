/**
 * ブラウザ内で音声結合・MP4合成
 * - Vercel 4.5MB リクエスト上限を回避
 * - ffmpeg.wasm Worker は toBlobURL で同一オリジン扱いに
 */

import { FFmpeg } from "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/+esm";
import { fetchFile, toBlobURL } from "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/+esm";

let ffmpegInstance = null;
let ffmpegLoading = null;

async function getFfmpeg(onProgress) {
  if (ffmpegInstance) return ffmpegInstance;
  if (!ffmpegLoading) {
    ffmpegLoading = (async () => {
      onProgress?.("動画エンジンを読み込み中…");
      const ffmpeg = new FFmpeg();
      const coreBase = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";
      const workerUrl = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/worker.js";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${coreBase}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${coreBase}/ffmpeg-core.wasm`, "application/wasm"),
        workerURL: await toBlobURL(workerUrl, "text/javascript"),
      });
      ffmpegInstance = ffmpeg;
      return ffmpeg;
    })();
  }
  return ffmpegLoading;
}

function audioBufferToWavBlob(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const samples = buffer.length;
  const blockAlign = (numChannels * bitDepth) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  const channels = Array.from({ length: numChannels }, (_, c) => buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

export async function concatAudioBlobs(blobs, onProgress) {
  if (blobs.length === 1) return blobs[0];

  onProgress?.("音声を結合中…");
  const ctx = new AudioContext();
  try {
    const buffers = await Promise.all(
      blobs.map(async (blob) => ctx.decodeAudioData(await blob.arrayBuffer()))
    );
    const sampleRate = buffers[0].sampleRate;
    const channels = buffers[0].numberOfChannels;
    const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);
    const merged = ctx.createBuffer(channels, totalLength, sampleRate);

    let pos = 0;
    for (const buf of buffers) {
      for (let c = 0; c < channels; c++) {
        merged.getChannelData(c).set(buf.getChannelData(c), pos);
      }
      pos += buf.length;
    }

    return audioBufferToWavBlob(merged);
  } finally {
    await ctx.close();
  }
}

export async function mergeImageAndAudio(imageBlob, audioBlob, onProgress) {
  onProgress?.("MP4を合成中…");
  const ffmpeg = await getFfmpeg(onProgress);

  await ffmpeg.writeFile("slide.png", await fetchFile(imageBlob));
  await ffmpeg.writeFile("audio.wav", await fetchFile(audioBlob));

  await ffmpeg.exec([
    "-loop", "1",
    "-i", "slide.png",
    "-i", "audio.wav",
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
  await ffmpeg.deleteFile("audio.wav");
  await ffmpeg.deleteFile("output.mp4");

  return new Blob([data.buffer], { type: "video/mp4" });
}
