import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const PORT = process.env.PORT || 3000;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite-preview-09-2025";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("❌ Missing GEMINI_API_KEY in .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL });

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
  res.send("🌱 EcoSort Render Server — ESP32-CAM Analyzer is live!");
});

app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer)
      return res.status(400).json({ error: "no image data" });

    const mime = req.file.mimetype || "image/jpeg";
    const base64 = req.file.buffer.toString("base64");

    console.log(`🖼️ Received ${req.file.size} bytes (${mime})`);

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mime,
          data: base64,
        },
      },
      { text: buildPrompt() },
    ]);

    const text = result.response.text();
    console.log("🧠 Gemini raw:", text);

    const match = text.match(/\{[\s\S]*\}/);
    const json = match ? JSON.parse(match[0]) : { label: "unknown", confidence: 0, notes: "parse failed" };

    res.json({ ok: true, result: json });
  } catch (err) {
    console.error("💥 Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
