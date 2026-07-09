/**
 * 非属人YouTube Tool1 — チャンネル設計書ジェネレーター
 */

const STORAGE_KEY = "yt_tool1_settings";
const MODEL = "gemini-2.5-flash";

const GENRE_LABELS = {
  auto: "おまかせ（参考チャンネルから推定）",
  commentary: "解説型（都市伝説・歴史・雑学・ミステリー解説）",
  narration: "朗読型（スカッと・感動・ドラマ朗読）",
  ranking: "ランキング型（TOP5・TOP10）",
  "ai-history": "AI歴史・ミステリー系",
};

const els = {
  apiKey: document.getElementById("api-key"),
  channelUrl: document.getElementById("channel-url"),
  channelPaste: document.getElementById("channel-paste"),
  genre: document.getElementById("genre"),
  differentiation: document.getElementById("differentiation"),
  btnGenerate: document.getElementById("btn-generate"),
  status: document.getElementById("status"),
  outputSection: document.getElementById("output-section"),
  output: document.getElementById("output"),
  btnCopy: document.getElementById("btn-copy"),
  btnDownload: document.getElementById("btn-download"),
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (s.apiKey) els.apiKey.value = s.apiKey;
    if (s.channelUrl) els.channelUrl.value = s.channelUrl;
    if (s.channelPaste) els.channelPaste.value = s.channelPaste;
    if (s.genre) els.genre.value = s.genre;
    if (s.differentiation) els.differentiation.value = s.differentiation;
  } catch (_) {
    /* ignore */
  }
}

function saveSettings() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      apiKey: els.apiKey.value.trim(),
      channelUrl: els.channelUrl.value.trim(),
      channelPaste: els.channelPaste.value.trim(),
      genre: els.genre.value,
      differentiation: els.differentiation.value.trim(),
    })
  );
}

function updateGenerateButton() {
  const ok = els.apiKey.value.trim().length > 10 && els.channelUrl.value.trim().length > 8;
  els.btnGenerate.disabled = !ok;
}

function setStatus(msg, type = "") {
  els.status.textContent = msg;
  els.status.className = "status" + (type ? ` ${type}` : "");
}

async function callGemini(apiKey, systemPrompt, userPrompt, useSearch = false) {
  const body = {
    apiKey,
    model: MODEL,
    systemPrompt,
    userPrompt,
    useSearch,
  };

  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `API error ${res.status}`);
  }
  return data.text;
}

function buildResearchPrompt(params) {
  return `あなたはYouTube非属人チャンネルの分析専門家です。
以下の参考チャンネル（TTP元）を分析し、JSONのみを返してください。Markdownや説明文は不要です。

## 参考チャンネルURL
${params.channelUrl}

## ユーザーが貼り付けた情報（あれば）
${params.channelPaste || "（なし）"}

## 指定ジャンル
${GENRE_LABELS[params.genre] || params.genre}

## 差別化したい点（ユーザー希望）
${params.differentiation || "（特になし）"}

## 出力JSONスキーマ（このキーだけ）
{
  "reference_channel_name": "推定チャンネル名",
  "estimated_genre": "解説型|朗読型|ランキング型|その他",
  "content_summary": "何をどう届けているか（3〜5文）",
  "target_viewer": "想定視聴者像",
  "title_patterns": ["タイトルの型1", "型2", "型3"],
  "thumbnail_style": "サムネの傾向",
  "posting_rhythm": "更新頻度の推定",
  "strengths": ["強み1", "強み2", "強み3"],
  "weaknesses_or_gaps": ["差別化の余地1", "余地2"],
  "keywords": ["キーワード1", "キーワード2", "...最大15個"]
}

URLの内容が不明な場合は、貼り付け情報とジャンル指定から合理的に推定してください。`;
}

function buildDesignPrompt(params, researchJson) {
  return `あなたは非属人YouTubeチャンネルの設計コンサルタントです。
参考チャンネル（TTP元）をモデリングしつつ、**丸コピーではなく差別化した**新チャンネル設計書をMarkdownで作成してください。

## 参考チャンネルURL
${params.channelUrl}

## 分析結果（JSON）
${researchJson}

## 指定ジャンル
${GENRE_LABELS[params.genre] || params.genre}

## 差別化したい点
${params.differentiation || "（分析結果の weaknesses_or_gaps を活かして提案）"}

## 出力ルール
- **日本語**で書く
- YouTube Studioに**そのままコピペできる**実用的な内容
- チャンネル名は**3案**（それぞれ1行で理由付き）
- ハンドル案を2〜3個（@形式）
- 概要欄はコードブロック内に**完成テンプレ**として出力
- キーワード（チャンネルタグ）はカンマ区切り1行
- タイトルの型を3パターン（例付き）
- 再生リスト案を4つ
- 投稿頻度・動画尺の目安
- 差別化ポイント（参考チャンネルとの違い）を明確に
- 注意事項（炎上回避・収益化）を短く
- 末尾に「YouTube開設チェックリスト」を箇条書き8項目

## 必須見出し構成（この順番で）

# チャンネル設計書（非属人YouTube）

## 1. コンセプト（1行）

## 2. チャンネル名案 ×3

## 3. ハンドル案

## 4. ターゲット視聴者

## 5. 概要欄テンプレ（コピペ用）

## 6. キーワード（チャンネルタグ）

## 7. タイトルの型 ×3

## 8. 投稿設計（頻度・尺・カテゴリ）

## 9. サムネ・演出の方針

## 10. 再生リスト案

## 11. 参考チャンネルとの差別化

## 12. 注意事項

## 13. YouTube開設チェックリスト

余計な前置きは不要。設計書本文のみ出力してください。`;
}

async function generateDesign() {
  saveSettings();
  const params = {
    channelUrl: els.channelUrl.value.trim(),
    channelPaste: els.channelPaste.value.trim(),
    genre: els.genre.value,
    differentiation: els.differentiation.value.trim(),
  };
  const apiKey = els.apiKey.value.trim();

  els.btnGenerate.disabled = true;
  els.outputSection.classList.add("hidden");

  try {
    setStatus("① 参考チャンネルを分析中…");
    const researchRaw = await callGemini(
      apiKey,
      "YouTubeチャンネル分析。JSONのみ返答。",
      buildResearchPrompt(params),
      true
    );

    let researchJson = researchRaw.trim();
    const jsonMatch = researchJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) researchJson = jsonMatch[0];

    setStatus("② チャンネル設計書を作成中…");
    const design = await callGemini(
      apiKey,
      "非属人YouTubeチャンネル設計書をMarkdownで作成。",
      buildDesignPrompt(params, researchJson),
      false
    );

    els.output.textContent = design.trim();
    els.outputSection.classList.remove("hidden");
    setStatus("完成しました。内容を確認してからYouTube Studioに反映してください。", "ok");
    els.outputSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    console.error(err);
    setStatus(`エラー: ${err.message}`, "error");
  } finally {
    updateGenerateButton();
  }
}

els.apiKey.addEventListener("input", () => {
  saveSettings();
  updateGenerateButton();
});
els.channelUrl.addEventListener("input", () => {
  saveSettings();
  updateGenerateButton();
});
els.channelPaste.addEventListener("input", saveSettings);
els.genre.addEventListener("change", saveSettings);
els.differentiation.addEventListener("input", saveSettings);

els.btnGenerate.addEventListener("click", generateDesign);

els.btnCopy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(els.output.textContent);
    setStatus("クリップボードにコピーしました。", "ok");
  } catch {
    setStatus("コピーに失敗しました。手動で選択してください。", "error");
  }
});

els.btnDownload.addEventListener("click", () => {
  const blob = new Blob([els.output.textContent], { type: "text/markdown;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "チャンネル設計書.md";
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus("Markdownファイルをダウンロードしました。", "ok");
});

loadSettings();
updateGenerateButton();
