import express from "express";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL =
  process.env.GEMINI_MODEL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("❌ Missing GEMINI_API_KEY in .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL });

// middleware for raw image data
app.use(express.raw({ type: "image/jpeg", limit: "10mb" }));

function buildPrompt() {
  return `
You are a STRICT waste classification system.

You MUST classify the object into ONLY ONE of these:
- biodegradable
- non_biodegradable
- hazardous

DO NOT guess common objects like "mobile phone" unless it is CLEAR.

Rules:
- biodegradable = food, paper, leaves, organic
- non_biodegradable = plastic, glass, metal
- hazardous = electronics, batteries, wires

If unsure → return:
{"class":"unknown","object":"unknown"}

Return ONLY valid JSON:
{"class":"<category>","object":"<object_name>"}
`;
}
app.get("/", (req, res) => {
  res.send("🌱 Ecosort is ON and ready!");
});

app.post("/analyze", async (req, res) => {
  try {
    if (!req.body || !req.body.length)
      return res.status(400).json({ error: "no image data" });

    const base64 = req.body.toString("base64");
    console.log(`🖼️ Received ${req.body.length} bytes`);

    const result = await model.generateContent([
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

app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
