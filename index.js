import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

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
  res.send("ESP32-CAM Gemini Waste Analyzer 🌍");
});

app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "no image uploaded" });

    const base64 = req.file.buffer.toString("base64");
    const mime = req.file.mimetype || "image/jpeg";

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
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Server up on ${PORT}`));
