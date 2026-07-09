/**
 * 非属人YouTube — 共通（API・設定・ジャンル）
 */

export const MODEL = "gemini-2.5-flash";
export const STORAGE_KEY = "yt_non_person_settings";

export const GENRE_LABELS = {
  auto: "おまかせ（チャンネルから推定）",
  commentary: "解説型（都市伝説・歴史・雑学・ミステリー解説）",
  narration: "朗読型（スカッと・感動・ドラマ朗読）",
  ranking: "ランキング型（TOP5・TOP10）",
  "ai-history": "AI歴史・ミステリー系",
};

export const LENGTH_LABELS = {
  short: "短尺（5〜10分・約2,000字）",
  medium: "中尺（15〜20分・約4,500字）",
  long: "長尺（20〜28分・約6,000字）",
};

export function loadSettings() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = localStorage.getItem("yt_tool1_settings");
      if (legacy) {
        const o = JSON.parse(legacy);
        return {
          apiKey: o.apiKey,
          tool1: {
            channelUrl: o.channelUrl,
            channelPaste: o.channelPaste,
            genre: o.genre,
            differentiation: o.differentiation,
          },
        };
      }
      return {};
    }
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveSettings(patch) {
  const current = loadSettings();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
}

export function saveToolSettings(toolKey, patch) {
  const current = loadSettings();
  const tool = { ...(current[toolKey] || {}), ...patch };
  saveSettings({ ...current, [toolKey]: tool, ...(patch.apiKey ? { apiKey: patch.apiKey } : {}) });
}

export async function parseJsonResponse(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    const preview = text.slice(0, 120).replace(/\s+/g, " ").trim();
    if (res.status === 413 || /entity too large/i.test(text)) {
      throw new Error("データが大きすぎます。台本を短くしてください。");
    }
    throw new Error(preview || `HTTP ${res.status}`);
  }
}

export async function callGemini(apiKey, systemPrompt, userPrompt, options = {}) {
  const { useSearch = false, maxOutputTokens = 8192 } = options;
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey,
      model: MODEL,
      systemPrompt,
      userPrompt,
      useSearch,
      maxOutputTokens,
    }),
  });
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data.text;
}

export function extractJson(text) {
  const trimmed = text.trim();
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match ? match[0] : trimmed;
}

export function bindCopyDownload(outputEl, statusEl, copyBtn, downloadBtn, filename) {
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(outputEl.textContent);
      statusEl.textContent = "クリップボードにコピーしました。";
      statusEl.className = "status ok";
    } catch {
      statusEl.textContent = "コピーに失敗しました。";
      statusEl.className = "status error";
    }
  });
  downloadBtn.addEventListener("click", () => {
    const blob = new Blob([outputEl.textContent], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    statusEl.textContent = "Markdownファイルをダウンロードしました。";
    statusEl.className = "status ok";
  });
}

export function initTabs() {
  const tabs = document.querySelectorAll(".tool-tab");
  const panels = document.querySelectorAll(".tool-panel");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tool;
      tabs.forEach((t) => t.classList.toggle("active", t === tab));
      panels.forEach((p) => p.classList.toggle("active", p.id === `panel-${target}`));
      const hash = target === "tool1" ? "#tool1" : target === "tool2" ? "#tool2" : "#tool3";
      history.replaceState(null, "", hash);
    });
  });
  if (location.hash === "#tool2") {
    document.querySelector('[data-tool="tool2"]')?.click();
  } else if (location.hash === "#tool3") {
    document.querySelector('[data-tool="tool3"]')?.click();
  }
}

export function bindSharedApiKey(inputEl, onChange) {
  const settings = loadSettings();
  if (settings.apiKey) inputEl.value = settings.apiKey;
  inputEl.addEventListener("input", () => {
    saveSettings({ apiKey: inputEl.value.trim() });
    onChange?.();
  });
}

export function getApiKey(inputEl) {
  return inputEl.value.trim();
}
