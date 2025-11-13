import express from "express";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite-preview-09-2025";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("❌ Missing GEMINI_API_KEY in .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
let model = genAI.getGenerativeModel({ model: MODEL });

// handle raw jpeg uploads
app.use(express.raw({ type: "image/jpeg", limit: "10mb" }));

function buildPrompt() {
  return `Return ONLY a single JSON object:
{
  "class": "<biodegradable|non_biodegradable|hazardous>"
}
Rules:
- Classify the main visible object in the photo.
- All electronic items are "hazardous".
- If confidence < 90%, respond with "again".
- If the image shows a phone, computer, or any tech device, use class: "hazardous".`;
}

// retry logic for 429 or temporary errors
async function safeGenerate(model, input, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await model.generateContent(input);
    } catch (err) {
      if (err.message.includes("429") && i < retries - 1) {
        console.warn(`⚠️ Gemini rate limited — retrying (${i + 1}/${retries})`);
        await new Promise((r) => setTimeout(r, 8000));
      } else if (err.message.includes("invalid model") && MODEL !== "gemini-2.0-flash-lite") {
        console.warn("⚙️ Falling back to gemini-2.0-flash-lite...");
        model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
      } else {
        throw err;
      }
    }
  }
}

app.get("/", (req, res) => {
  res.send("Ecosort is ON");
});

app.post("/analyze", async (req, res) => {
  try {
    if (!req.body || !req.body.length)
      return res.status(400).json({ error: "no image data" });

    console.log(`🖼️ Received ${req.body.length} bytes from ESP`);

    const base64 = req.body.toString("base64");

    const result = await safeGenerate(model, [
      { inlineData: { mimeType: "image/jpeg", data: base64 } },
      { text: buildPrompt() },
    ]);

    const text = result.response.text();
    console.log("🧠 Gemini raw:", text);

    const match = text.match(/\{[\s\S]*\}/);
    const json = match ? JSON.parse(match[0]) : { class: "unknown" };

    res.json({ ok: true, result: json });
  } catch (err) {
    console.error("💥 Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
