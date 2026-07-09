/**
 * Vercel Serverless — Gemini TTS（音声生成）
 * 500 はプレビュー版で散発するため自動リトライ・短チャンク推奨
 */

const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const MAX_TEXT_LEN = 1500;
const MAX_RETRIES = 4;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeTranscript(text) {
  return String(text)
    .trim()
    .replace(/```/g, "'''")
    .replace(/\u0000/g, "")
    .slice(0, MAX_TEXT_LEN);
}

function buildTtsPrompt(text, variant = 0) {
  const transcript = sanitizeTranscript(text);
  if (variant === 0) {
    return [
      "Synthesize speech for the following Japanese narration transcript.",
      "Read it aloud in a calm, clear voice.",
      "",
      "#### TRANSCRIPT",
      transcript,
      "",
      "Now generate the audio for this script.",
    ].join("\n");
  }
  return [
    "Read the following Japanese text aloud in a calm, clear narration voice.",
    "",
    transcript,
    "",
    "Now generate the audio for this script.",
  ].join("\n");
}

function parsePcmRate(mimeType) {
  const m = String(mimeType || "").match(/rate=(\d+)/i);
  return m ? Number(m[1]) : 24000;
}

function pcmToWav(pcmBuffer, sampleRate = 24000) {
  const channels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([header, pcmBuffer]);
}

function isRetryable(status, message) {
  if ([429, 500, 502, 503].includes(status)) return true;
  return /internal error|overloaded|try again|resource exhausted/i.test(message || "");
}

function buildRequestBody(narration, voice, variant) {
  return {
    contents: [{ parts: [{ text: buildTtsPrompt(narration, variant) }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  };
}

async function requestTts(apiKey, narration, voice) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  let lastError = "TTS failed";

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(1200 * attempt);

    const variant = attempt % 2;
    const body = buildRequestBody(narration, voice, variant);

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    let data;
    try {
      data = await geminiRes.json();
    } catch {
      lastError = `Gemini TTS error (${geminiRes.status})`;
      if (isRetryable(geminiRes.status, lastError) && attempt < MAX_RETRIES - 1) continue;
      return { ok: false, status: geminiRes.status, error: lastError };
    }

    if (!geminiRes.ok) {
      lastError = data?.error?.message || `Gemini TTS error (${geminiRes.status})`;
      if (isRetryable(geminiRes.status, lastError) && attempt < MAX_RETRIES - 1) continue;
      return { ok: false, status: geminiRes.status, error: lastError };
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const audioPart = parts.find((p) => p.inlineData?.data);
    if (!audioPart) {
      lastError = "音声データが返りませんでした";
      if (attempt < MAX_RETRIES - 1) continue;
      return { ok: false, status: 502, error: lastError };
    }

    const rawMime = audioPart.inlineData.mimeType || "audio/wav";
    let outMime = rawMime;
    let outData = audioPart.inlineData.data;

    if (/pcm|L16/i.test(rawMime)) {
      const pcm = Buffer.from(outData, "base64");
      const wav = pcmToWav(pcm, parsePcmRate(rawMime));
      outMime = "audio/wav";
      outData = wav.toString("base64");
    }

    return { ok: true, mimeType: outMime, data: outData };
  }

  return { ok: false, status: 502, error: `${lastError}（${MAX_RETRIES}回再試行後）` };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { apiKey, text, voice = "Kore" } = req.body || {};

  if (!apiKey) return res.status(400).json({ error: "APIキーが必要です" });
  if (!text || !String(text).trim()) return res.status(400).json({ error: "text が必要です" });

  try {
    const result = await requestTts(apiKey, String(text).trim(), voice);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(200).json({
      mimeType: result.mimeType,
      data: result.data,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
