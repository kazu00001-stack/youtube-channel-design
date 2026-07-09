/**
 * Vercel Serverless — Gemini TTS（音声生成）
 */

const TTS_MODEL = "gemini-2.5-flash-preview-tts";

function buildTtsPrompt(text) {
  const transcript = String(text).trim();
  // TTSモデルは「読み上げ台本」であることが明確なプロンプトが必要
  return [
    "Read the following Japanese narration script aloud in a calm, clear voice.",
    "",
    "```",
    transcript,
    "```",
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
        role: "user",
        parts: [{ text: buildTtsPrompt(narration) }],
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

    const rawMime = audioPart.inlineData.mimeType || "audio/wav";
    let outMime = rawMime;
    let outData = audioPart.inlineData.data;

    if (/pcm|L16/i.test(rawMime)) {
      const pcm = Buffer.from(outData, "base64");
      const wav = pcmToWav(pcm, parsePcmRate(rawMime));
      outMime = "audio/wav";
      outData = wav.toString("base64");
    }

    return res.status(200).json({
      mimeType: outMime,
      data: outData,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
