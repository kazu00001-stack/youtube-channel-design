/**
 * Vercel Serverless — Gemini TTS（音声生成）
 */

const TTS_MODEL = "gemini-2.5-flash-preview-tts";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { apiKey, text, voice = "Kore" } = req.body || {};

  if (!apiKey) return res.status(400).json({ error: "APIキーが必要です" });
  if (!text || !String(text).trim()) return res.status(400).json({ error: "text が必要です" });

  const narration = String(text).trim().slice(0, 4500);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [
      {
        parts: [
          {
            text: `落ち着いた日本語のナレーター声で、ゆっくりはっきり読み上げてください。感情を込めすぎない解説調です。\n\n${narration}`,
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  };

  try {
    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      const msg = data?.error?.message || `Gemini TTS error (${geminiRes.status})`;
      return res.status(geminiRes.status).json({ error: msg });
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const audioPart = parts.find((p) => p.inlineData?.data);
    if (!audioPart) {
      return res.status(502).json({ error: "音声データが返りませんでした" });
    }

    return res.status(200).json({
      mimeType: audioPart.inlineData.mimeType || "audio/wav",
      data: audioPart.inlineData.data,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
