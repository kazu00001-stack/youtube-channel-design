import {
  GENRE_LABELS,
  callGemini,
  extractJson,
  getApiKey,
  loadSettings,
  saveToolSettings,
} from "./app-shared.js";
import {
  base64ToBlob,
  canvasToBlob,
  downloadBlob,
  renderThumbnail,
  renderVideoSlide,
} from "./app-thumbnail.js";
import { concatAudioBlobs, mergeImageAndAudio } from "./app-video.js";

const VOICE_OPTIONS = {
  Kore: "落ち着いた男性（解説向け）",
  Puck: "明るめ",
  Charon: "低め・重厚",
};

const els = {
  apiKey: document.getElementById("api-key"),
  script: document.getElementById("t3-script"),
  thumbTop: document.getElementById("t3-thumb-top"),
  thumbBottom: document.getElementById("t3-thumb-bottom"),
  genre: document.getElementById("t3-genre"),
  voice: document.getElementById("t3-voice"),
  btnGenerate: document.getElementById("t3-btn-generate"),
  status: document.getElementById("t3-status"),
  outputSection: document.getElementById("t3-output-section"),
  thumbPreview: document.getElementById("t3-thumb-preview"),
  btnThumb: document.getElementById("t3-btn-thumb"),
  btnAudio: document.getElementById("t3-btn-audio"),
  btnMp4: document.getElementById("t3-btn-mp4"),
  videoPreview: document.getElementById("t3-video-preview"),
};

let lastAssets = { thumbBlob: null, audioBlob: null, mp4Blob: null };

function loadTool3Settings() {
  const s = loadSettings().tool3 || {};
  if (s.script) els.script.value = s.script;
  if (s.thumbTop) els.thumbTop.value = s.thumbTop;
  if (s.thumbBottom) els.thumbBottom.value = s.thumbBottom;
  if (s.genre) els.genre.value = s.genre;
  if (s.voice) els.voice.value = s.voice;
}

function saveTool3() {
  saveToolSettings("tool3", {
    script: els.script.value.trim(),
    thumbTop: els.thumbTop.value.trim(),
    thumbBottom: els.thumbBottom.value.trim(),
    genre: els.genre.value,
    voice: els.voice.value,
  });
}

function updateButton() {
  els.btnGenerate.disabled =
    getApiKey(els.apiKey).length <= 10 || els.script.value.trim().length < 100;
}

function setStatus(msg, type = "") {
  els.status.textContent = msg;
  els.status.className = "status" + (type ? ` ${type}` : "");
}

function buildParsePrompt(params) {
  return `YouTube非属人動画の台本を解析。JSONのみ返答。

## 台本
${params.script.slice(0, 12000)}

## ジャンル
${GENRE_LABELS[params.genre]}

## ユーザー指定サムネ（空なら台本から抽出）
上段: ${params.thumbTop || "（自動）"}
下段: ${params.thumbBottom || "（自動）"}

{
  "title": "動画タイトル",
  "thumbnail": {
    "top": "サムネ上段（15字以内目安）",
    "bottom": "サムネ下段（12字以内目安）"
  },
  "narration": "ナレーション全文のみ。見出し・【】・ト書き・FILE番号・幕名は除去。読み上げ用の連続テキスト。",
  "video_title_slide": "動画内に表示する短いタイトル",
  "genre": "commentary|narration|ranking"
}

narrationは${params.script.length > 3500 ? "長いので要点を押さえつつ" : ""}読み上げ可能な自然な日本語に。`;
}

async function callTts(apiKey, text, voice) {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, text, voice }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "TTS failed");
  return base64ToBlob(data.data, data.mimeType || "audio/wav");
}

function splitNarration(text, maxLen = 4000) {
  const chunks = [];
  let rest = text.trim();
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf("。", maxLen);
    if (cut < maxLen * 0.5) cut = maxLen;
    else cut += 1;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

async function generateTool3() {
  saveTool3();
  const apiKey = getApiKey(els.apiKey);
  const params = {
    script: els.script.value.trim(),
    thumbTop: els.thumbTop.value.trim(),
    thumbBottom: els.thumbBottom.value.trim(),
    genre: els.genre.value,
    voice: els.voice.value,
  };

  els.btnGenerate.disabled = true;
  els.outputSection.classList.add("hidden");
  lastAssets = { thumbBlob: null, audioBlob: null, mp4Blob: null };
  els.videoPreview.removeAttribute("src");
  els.thumbPreview.removeAttribute("src");

  try {
    setStatus("① 台本を解析中…");
    const parsedRaw = await callGemini(
      apiKey,
      "JSONのみ",
      buildParsePrompt(params),
      { maxOutputTokens: 8192 }
    );
    const parsed = JSON.parse(extractJson(parsedRaw));
    const genre = parsed.genre || params.genre || "commentary";
    const thumb = {
      top: params.thumbTop || parsed.thumbnail?.top || parsed.title || "タイトル",
      bottom: params.thumbBottom || parsed.thumbnail?.bottom || "",
      genre,
    };

    if (!params.thumbTop) els.thumbTop.value = thumb.top;
    if (!params.thumbBottom && thumb.bottom) els.thumbBottom.value = thumb.bottom;

    setStatus("② サムネイルを生成中…");
    const thumbCanvas = renderThumbnail(thumb);
    const thumbBlob = await canvasToBlob(thumbCanvas);
    lastAssets.thumbBlob = thumbBlob;
    els.thumbPreview.src = URL.createObjectURL(thumbBlob);

    const narration = parsed.narration || params.script;
    const chunks = splitNarration(narration);

    setStatus(`③ ナレーション音声を生成中…（${chunks.length}パート）`);
    const audioParts = [];
    for (let i = 0; i < chunks.length; i++) {
      setStatus(`③ 音声生成 ${i + 1}/${chunks.length}…`);
      audioParts.push(await callTts(apiKey, chunks[i], params.voice));
    }
    const audioBlob =
      audioParts.length > 1
        ? await concatAudioBlobs(audioParts, (m) => setStatus(`③ ${m}`))
        : audioParts[0];
    lastAssets.audioBlob = audioBlob;
    els.outputSection.classList.remove("hidden");

    try {
      setStatus("④ MP4を合成中…");
      const slideCanvas = renderVideoSlide({
        title: parsed.video_title_slide || parsed.title,
        genre,
      });
      const slideBlob = await canvasToBlob(slideCanvas);
      const mp4Blob = await mergeImageAndAudio(slideBlob, audioBlob, (m) => setStatus(`④ ${m}`));
      lastAssets.mp4Blob = mp4Blob;
      els.videoPreview.src = URL.createObjectURL(mp4Blob);
      setStatus("完成！サムネ・音声・MP4をダウンロードできます。", "ok");
    } catch (videoErr) {
      console.error(videoErr);
      setStatus(
        `サムネ・音声は完成しました。MP4合成のみ失敗: ${videoErr.message}（音声・サムネはダウンロード可）`,
        "ok"
      );
    }

    els.outputSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    console.error(err);
    setStatus(`エラー: ${err.message}`, "error");
  } finally {
    updateButton();
  }
}

export function initTool3() {
  loadTool3Settings();
  [els.script, els.thumbTop, els.thumbBottom, els.genre, els.voice].forEach((el) => {
    el.addEventListener("input", () => {
      saveTool3();
      updateButton();
    });
    el.addEventListener("change", () => {
      saveTool3();
      updateButton();
    });
  });
  document.getElementById("api-key")?.addEventListener("input", updateButton);
  els.btnGenerate.addEventListener("click", generateTool3);

  els.btnThumb.addEventListener("click", () => {
    if (lastAssets.thumbBlob) downloadBlob(lastAssets.thumbBlob, "サムネイル.png");
  });
  els.btnAudio.addEventListener("click", () => {
    if (lastAssets.audioBlob) downloadBlob(lastAssets.audioBlob, "ナレーション.wav");
  });
  els.btnMp4.addEventListener("click", () => {
    if (lastAssets.mp4Blob) downloadBlob(lastAssets.mp4Blob, "動画.mp4");
  });

  updateButton();
}

export { VOICE_OPTIONS };
