import {
  GENRE_LABELS,
  LENGTH_LABELS,
  bindCopyDownload,
  callGemini,
  extractJson,
  getApiKey,
  loadSettings,
  saveToolSettings,
} from "./app-shared.js";

const els = {
  apiKey: document.getElementById("api-key"),
  myChannelUrl: document.getElementById("t2-my-channel-url"),
  myChannelPaste: document.getElementById("t2-my-channel-paste"),
  designDoc: document.getElementById("t2-design-doc"),
  genre: document.getElementById("t2-genre"),
  videoTheme: document.getElementById("t2-video-theme"),
  length: document.getElementById("t2-length"),
  btnGenerate: document.getElementById("t2-btn-generate"),
  status: document.getElementById("t2-status"),
  outputSection: document.getElementById("t2-output-section"),
  output: document.getElementById("t2-output"),
  btnCopy: document.getElementById("t2-btn-copy"),
  btnDownload: document.getElementById("t2-btn-download"),
};

function loadTool2Settings() {
  const s = loadSettings().tool2 || {};
  if (s.myChannelUrl) els.myChannelUrl.value = s.myChannelUrl;
  if (s.myChannelPaste) els.myChannelPaste.value = s.myChannelPaste;
  if (s.designDoc) els.designDoc.value = s.designDoc;
  if (s.genre) els.genre.value = s.genre;
  if (s.videoTheme) els.videoTheme.value = s.videoTheme;
  if (s.length) els.length.value = s.length;
}

function saveTool2() {
  saveToolSettings("tool2", {
    myChannelUrl: els.myChannelUrl.value.trim(),
    myChannelPaste: els.myChannelPaste.value.trim(),
    designDoc: els.designDoc.value.trim(),
    genre: els.genre.value,
    videoTheme: els.videoTheme.value.trim(),
    length: els.length.value,
  });
}

function updateButton() {
  els.btnGenerate.disabled =
    getApiKey(els.apiKey).length <= 10 || els.myChannelUrl.value.trim().length <= 8;
}

function setStatus(msg, type = "") {
  els.status.textContent = msg;
  els.status.className = "status" + (type ? ` ${type}` : "");
}

function scriptStructure(genre) {
  if (genre === "narration") {
    return `朗読型6幕: ①導入 ②日常 ③転機 ④クライマックス ⑤スカッと/感動 ⑥締め`;
  }
  if (genre === "ranking") {
    return `ランキング型: 導入→5位〜1位（各に解説）→総評→登録誘導`;
  }
  return `解説型5幕: ①掴み(45秒・この動画で分かること3点) ②概要 ③深掘りA ④深掘りB ⑤考察・登録誘導`;
}

function buildOwnChannelPrompt(params) {
  return `自社YouTube非属人チャンネルを分析。JSONのみ。

## 自チャンネルURL
${params.myChannelUrl}

## 貼り付け（概要欄・動画タイトル等）
${params.myChannelPaste || "（なし）"}

## Tool1設計書（あれば）
${params.designDoc || "（なし）"}

## 指定ジャンル
${GENRE_LABELS[params.genre]}

{
  "channel_name": "",
  "genre": "",
  "concept_one_line": "",
  "target_viewer": "",
  "existing_video_themes": ["既存/推定テーマ"],
  "title_style": "",
  "tone": "",
  "content_gaps": ["まだ扱っていないネタ"],
  "next_video_suggestions": ["企画候補1", "候補2", "候補3"]
}`;
}

function buildCompetitorPrompt(params, ownJson) {
  return `同ジャンルの競合YouTube非属人チャンネルをリサーチ。JSONのみ。Google検索で最新情報を参照。

## 自チャンネル分析
${ownJson}

## 自チャンネルURL
${params.myChannelUrl}

## ジャンル
${GENRE_LABELS[params.genre]}

{
  "competitors": [
    {
      "name": "チャンネル名",
      "url": "https://www.youtube.com/@...",
      "subscriber_scale": "推定規模",
      "strengths": ["強み"],
      "title_patterns": ["伸びているタイトル例"],
      "differentiation_vs_mine": "自チャンネルとの差"
    }
  ],
  "market_insights": ["市場の傾向1", "傾向2"],
  "winning_patterns": ["伸びる企画パターン1", "パターン2"],
  "gaps_to_attack": ["競合が弱い/未カバーの領域"]
}

competitorsは3〜5件。`;
}

function buildScriptPrompt(params, ownJson, competitorJson) {
  const theme =
    params.videoTheme ||
    "（自チャンネル分析の next_video_suggestions から最適な1本を選ぶ）";

  return `非属人YouTubeの「競合リサーチ結果＋台本」をMarkdownで作成。

## 自チャンネル分析
${ownJson}

## 競合リサーチ
${competitorJson}

## 今回の動画テーマ
${theme}

## ジャンル
${GENRE_LABELS[params.genre]}

## 尺
${LENGTH_LABELS[params.length]}

## 台本構成
${scriptStructure(params.genre)}

## 出力構成（この順・見出し必須）

# 競合リサーチ＋台本

## 1. 競合分析サマリー
表形式: チャンネル名 | URL | 強み | 参考にする点

## 2. 市場インサイト（3〜5行）

## 3. 今回の企画
- タイトル案×3（YouTube用・【】タグ含む）
- 採用タイトル（1本）
- サムネ文案（上段・下段）
- 尺・文字数目安

## 4. 台本（フル原稿）
幕/パート見出し付き。ナレーション全文。解説型なら冒頭45秒で「この動画で分かること3点」。

## 5. 投稿設定
- 説明文（コピペ用）
- タグ30個（カンマ区切り）
- カテゴリ・視聴者層の推奨

## 6. Tool3用メモ
- サムネ上段/下段確定文案
- 推奨BGMトーン
- 画面イメージ（シーンごと3〜5行）

禁止: 皇室批判、実在人物の犯罪断定、心霊スポット侵入助長。
本文のみ。`;
}

async function generateTool2() {
  saveTool2();
  const apiKey = getApiKey(els.apiKey);
  const params = {
    myChannelUrl: els.myChannelUrl.value.trim(),
    myChannelPaste: els.myChannelPaste.value.trim(),
    designDoc: els.designDoc.value.trim(),
    genre: els.genre.value,
    videoTheme: els.videoTheme.value.trim(),
    length: els.length.value,
  };

  els.btnGenerate.disabled = true;
  els.outputSection.classList.add("hidden");

  try {
    setStatus("① 自チャンネルを分析中…");
    const ownRaw = await callGemini(
      apiKey,
      "JSONのみ",
      buildOwnChannelPrompt(params),
      { useSearch: true }
    );
    const ownJson = extractJson(ownRaw);

    setStatus("② 競合チャンネルをリサーチ中…");
    const compRaw = await callGemini(
      apiKey,
      "JSONのみ",
      buildCompetitorPrompt(params, ownJson),
      { useSearch: true }
    );
    const compJson = extractJson(compRaw);

    setStatus("③ 台本を作成中…（1〜2分かかることがあります）");
    const script = await callGemini(
      apiKey,
      "Markdown台本",
      buildScriptPrompt(params, ownJson, compJson),
      { useSearch: false, maxOutputTokens: 16384 }
    );

    els.output.textContent = script.trim();
    els.outputSection.classList.remove("hidden");
    setStatus("完成しました。事実関係は必ずご自身で確認してください。", "ok");
    els.outputSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    setStatus(`エラー: ${err.message}`, "error");
  } finally {
    updateButton();
  }
}

export function initTool2() {
  loadTool2Settings();
  [els.myChannelUrl, els.myChannelPaste, els.designDoc, els.genre, els.videoTheme, els.length].forEach(
    (el) => {
      el.addEventListener("input", () => {
        saveTool2();
        updateButton();
      });
      el.addEventListener("change", () => {
        saveTool2();
        updateButton();
      });
    }
  );
  document.getElementById("api-key")?.addEventListener("input", updateButton);
  els.btnGenerate.addEventListener("click", generateTool2);
  bindCopyDownload(els.output, els.status, els.btnCopy, els.btnDownload, "競合リサーチと台本.md");
  updateButton();
}
