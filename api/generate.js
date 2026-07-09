/**
 * Vercel Serverless — Gemini API プロキシ
 * APIキーはリクエスト body で受け取り、サーバーに保存しない
 */

const DEFAULT_MODEL = "gemini-2.5-flash";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { apiKey, model, systemPrompt, userPrompt, useSearch, maxOutputTokens } = req.body || {};

  if (!apiKey || typeof apiKey !== "string") {
    return res.status(400).json({ error: "APIキーが必要です" });
  }
  if (!userPrompt) {
    return res.status(400).json({ error: "userPrompt が必要です" });
  }

  const modelName = model || DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const contents = [];
  if (systemPrompt) {
    contents.push({
      role: "user",
      parts: [{ text: `[システム指示]\n${systemPrompt}` }],
    });
    contents.push({
      role: "model",
      parts: [{ text: "了解しました。指示に従います。" }],
    });
  }
  contents.push({
    role: "user",
    parts: [{ text: userPrompt }],
  });

  const body = {
    contents,
    generationConfig: {
      temperature: 0.85,
      maxOutputTokens: maxOutputTokens || 8192,
    },
  };

  if (useSearch) {
    body.tools = [{ google_search: {} }];
  }

  try {
    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      const msg =
        data?.error?.message ||
        data?.error?.status ||
        `Gemini API error (${geminiRes.status})`;
      return res.status(geminiRes.status).json({ error: msg });
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || "").join("\n").trim();

    if (!text) {
      return res.status(502).json({ error: "生成結果が空でした。もう一度お試しください。" });
    }

    return res.status(200).json({ text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
