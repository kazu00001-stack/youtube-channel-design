import {
  GENRE_LABELS,
  bindCopyDownload,
  bindSharedApiKey,
  callGemini,
  extractJson,
  getApiKey,
  loadSettings,
  saveToolSettings,
} from "./app-shared.js";

const els = {
  apiKey: document.getElementById("api-key"),
  channelUrl: document.getElementById("t1-channel-url"),
  channelPaste: document.getElementById("t1-channel-paste"),
  genre: document.getElementById("t1-genre"),
  differentiation: document.getElementById("t1-differentiation"),
  btnGenerate: document.getElementById("t1-btn-generate"),
  status: document.getElementById("t1-status"),
  outputSection: document.getElementById("t1-output-section"),
  output: document.getElementById("t1-output"),
  btnCopy: document.getElementById("t1-btn-copy"),
  btnDownload: document.getElementById("t1-btn-download"),
};

function loadTool1Settings() {
  const s = loadSettings().tool1 || {};
  if (s.channelUrl) els.channelUrl.value = s.channelUrl;
  if (s.channelPaste) els.channelPaste.value = s.channelPaste;
  if (s.genre) els.genre.value = s.genre;
  if (s.differentiation) els.differentiation.value = s.differentiation;
}

function saveTool1() {
  saveToolSettings("tool1", {
    channelUrl: els.channelUrl.value.trim(),
    channelPaste: els.channelPaste.value.trim(),
    genre: els.genre.value,
    differentiation: els.differentiation.value.trim(),
  });
}

function updateButton() {
  els.btnGenerate.disabled =
    getApiKey(els.apiKey).length <= 10 || els.channelUrl.value.trim().length <= 8;
}

function setStatus(msg, type = "") {
  els.status.textContent = msg;
  els.status.className = "status" + (type ? ` ${type}` : "");
}

function buildResearchPrompt(params) {
  return `YouTube非属人チャンネル分析。JSONのみ返答。

## 参考チャンネルURL
${params.channelUrl}

## 貼り付け情報
${params.channelPaste || "（なし）"}

## ジャンル
${GENRE_LABELS[params.genre]}

## 差別化
${params.differentiation || "（なし）"}

{
  "reference_channel_name": "",
  "estimated_genre": "",
  "content_summary": "",
  "target_viewer": "",
  "title_patterns": [],
  "thumbnail_style": "",
  "posting_rhythm": "",
  "strengths": [],
  "weaknesses_or_gaps": [],
  "keywords": []
}`;
}

function buildDesignPrompt(params, researchJson) {
  return `非属人YouTubeのチャンネル設計書をMarkdownで作成。参考をTTPしつつ差別化。

URL: ${params.channelUrl}
分析: ${researchJson}
ジャンル: ${GENRE_LABELS[params.genre]}
差別化: ${params.differentiation || "分析結果から提案"}

見出し:# チャンネル設計書 → 1.コンセプト 2.チャンネル名案×3 3.ハンドル案 4.ターゲット 5.概要欄テンプレ 6.キーワード 7.タイトルの型×3 8.投稿設計 9.サムネ方針 10.再生リスト案 11.差別化 12.注意 13.開設チェックリスト
概要欄はコードブロック。本文のみ。`;
}

async function generateDesign() {
  saveTool1();
  const apiKey = getApiKey(els.apiKey);
  const params = {
    channelUrl: els.channelUrl.value.trim(),
    channelPaste: els.channelPaste.value.trim(),
    genre: els.genre.value,
    differentiation: els.differentiation.value.trim(),
  };

  els.btnGenerate.disabled = true;
  els.outputSection.classList.add("hidden");

  try {
    setStatus("① 参考チャンネルを分析中…");
    const researchRaw = await callGemini(
      apiKey,
      "JSONのみ",
      buildResearchPrompt(params),
      { useSearch: true }
    );

    setStatus("② チャンネル設計書を作成中…");
    const design = await callGemini(
      apiKey,
      "Markdown設計書",
      buildDesignPrompt(params, extractJson(researchRaw)),
      { useSearch: false }
    );

    els.output.textContent = design.trim();
    els.outputSection.classList.remove("hidden");
    setStatus("完成しました。", "ok");
    els.outputSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    setStatus(`エラー: ${err.message}`, "error");
  } finally {
    updateButton();
  }
}

export function initTool1() {
  loadTool1Settings();
  bindSharedApiKey(els.apiKey, updateButton);
  [els.channelUrl, els.channelPaste, els.genre, els.differentiation].forEach((el) => {
    el.addEventListener("input", () => {
      saveTool1();
      updateButton();
    });
    el.addEventListener("change", () => {
      saveTool1();
      updateButton();
    });
  });
  els.btnGenerate.addEventListener("click", generateDesign);
  bindCopyDownload(els.output, els.status, els.btnCopy, els.btnDownload, "チャンネル設計書.md");
  updateButton();
}
