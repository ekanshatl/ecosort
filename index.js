import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("❌ Missing GEMINI_API_KEY in .env");
  process.exit(1);
}

const client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

function buildPrompt() {
  return `Return ONLY a single JSON object:
{
  "label": "<biodegradable|non_biodegradable|hazardous>",
  "confidence": <float 0.0-1.0>,
  "notes": "<short reason>"
}
Classify the main item in the image as biodegradable, non_biodegradable, or hazardous.`;
}

app.get("/", (req, res) => {
  res.send("🌿 ESP32-CAM EcoSort Analyzer is live!");
});

// ✅ New raw-body version for ESP32 uploads
app.post("/analyze", express.raw({ type: "image/*", limit: "10mb" }), async (req, res) => {
  try {
    if (!req.body || !req.body.length)
      return res.status(400).json({ error: "no image data" });

    const base64 = req.body.toString("base64");
    const mime = req.headers["content-type"] || "image/jpeg";

    console.log(`📸 Received ${req.body.length} bytes from ESP32`);

    const response = await client.models.generateContent({
      model: MODEL,
      contents: [
        { inlineData: { mimeType: mime, data: base64 } },
        { text: buildPrompt() },
      ],
    });

    const raw = response.text ?? response.outputText ?? "";
    let result;

    try {
      result = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) result = JSON.parse(m[0]);
      else throw new Error("Invalid JSON from model");
    }

    res.json({ ok: true, result });
  } catch (err) {
    console.error("🔥 SERVER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Server live on port ${PORT}`));
