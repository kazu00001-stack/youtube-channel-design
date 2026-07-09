/**
 * サーバーAPI経由で音声結合・MP4合成（ffmpeg.wasm の Worker 問題を回避）
 */

async function blobToBase64(blob) {
  const buf = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function concatAudioBlobs(blobs, onProgress) {
  if (blobs.length === 1) return blobs[0];

  onProgress?.("音声を結合中（サーバー）…");
  const parts = await Promise.all(blobs.map(blobToBase64));
  const res = await fetch("/api/concat-audio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parts }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "音声結合に失敗しました");

  const bin = atob(data.data);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: data.mimeType || "audio/wav" });
}

export async function mergeImageAndAudio(imageBlob, audioBlob, onProgress) {
  onProgress?.("MP4を合成中（サーバー）…");
  const [imageBase64, audioBase64] = await Promise.all([
    blobToBase64(imageBlob),
    blobToBase64(audioBlob),
  ]);

  const res = await fetch("/api/merge-video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageBase64,
      audioBase64,
      audioMime: audioBlob.type,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "MP4合成に失敗しました");

  const bin = atob(data.data);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: data.mimeType || "video/mp4" });
}
