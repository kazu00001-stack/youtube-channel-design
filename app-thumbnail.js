/**
 * サムネイル生成（Canvas 1280×720）
 */

const W = 1280;
const H = 720;
const LEFT_W = Math.floor(W * 0.55);

export function renderThumbnail({ top, bottom, genre = "commentary" }) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // 左: グラデーション背景（写真の代わり）
  const grad = ctx.createLinearGradient(0, 0, LEFT_W, H);
  if (genre === "narration") {
    grad.addColorStop(0, "#4a1942");
    grad.addColorStop(1, "#1a0a18");
  } else {
    grad.addColorStop(0, "#1a1a2e");
    grad.addColorStop(0.5, "#0f0f1a");
    grad.addColorStop(1, "#050508");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, LEFT_W, H);

  // 左に薄い赤ティント
  ctx.fillStyle = "rgba(120, 0, 0, 0.35)";
  ctx.fillRect(0, 0, LEFT_W, H);

  // 右: 上 深紅 / 下 黒
  ctx.fillStyle = "#b90c1c";
  ctx.fillRect(LEFT_W, 0, W - LEFT_W, H * 0.42);
  ctx.fillStyle = "#000";
  ctx.fillRect(LEFT_W, H * 0.42, W - LEFT_W, H * 0.58);

  // 区切り線
  ctx.strokeStyle = "#ff2d2d";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(LEFT_W, 0);
  ctx.lineTo(LEFT_W, H);
  ctx.stroke();

  drawWrappedText(ctx, top || "タイトル上段", LEFT_W + 24, 36, W - LEFT_W - 48, H * 0.38, {
    font: 'bold 52px "Hiragino Sans", "Noto Sans JP", sans-serif',
    fill: "#fff",
    stroke: "#000",
    strokeWidth: 3,
    maxLines: 3,
  });

  drawWrappedText(ctx, bottom || "タイトル下段", LEFT_W + 20, H * 0.42 + 28, W - LEFT_W - 40, H * 0.52, {
    font: 'bold 58px "Hiragino Sans", "Noto Sans JP", sans-serif',
    fill: "#ffff00",
    stroke: "#000",
    strokeWidth: 4,
    maxLines: 2,
  });

  return canvas;
}

export function renderVideoSlide({ title, genre = "commentary" }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, genre === "narration" ? "#2d1b3d" : "#12121f");
  grad.addColorStop(1, "#000");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.font = '24px "Hiragino Sans", sans-serif';
  ctx.fillText("非属人YouTube Tool3", 40, H - 40);

  if (title) {
    drawWrappedText(ctx, title, 80, 280, W - 160, 200, {
      font: 'bold 48px "Hiragino Sans", "Noto Sans JP", sans-serif',
      fill: "#eee",
      stroke: "#000",
      strokeWidth: 2,
      maxLines: 3,
    });
  }

  return canvas;
}

function drawWrappedText(ctx, text, x, y, maxW, maxH, opts) {
  const { font, fill, stroke, strokeWidth = 0, maxLines = 4 } = opts;
  ctx.font = font;
  const lines = wrapLines(ctx, text, maxW, maxLines);
  const lineHeight = parseInt(font, 10) * 1.15;
  let cy = y;
  for (const line of lines) {
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth;
      ctx.strokeText(line, x, cy);
    }
    ctx.fillStyle = fill;
    ctx.fillText(line, x, cy);
    cy += lineHeight;
    if (cy > y + maxH) break;
  }
}

function wrapLines(ctx, text, maxW, maxLines) {
  const chars = [...text];
  const lines = [];
  let line = "";
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = ch;
      if (lines.length >= maxLines) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

export function canvasToBlob(canvas, type = "image/png") {
  return new Promise((resolve) => canvas.toBlob(resolve, type, 0.92));
}

export function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function base64ToBlob(base64, mimeType) {
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mimeType });
}
