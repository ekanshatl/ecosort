import express from "express";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

if (!GEMINI_API_KEY) {
  console.error("❌ Missing GEMINI_API_KEY");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL });

// ESP sends raw JPEG
app.use(express.raw({ type: "image/jpeg", limit: "10mb" }));

// 🔥 STRICT PROMPT (very important)
function buildPrompt() {
  return `
You are a STRICT waste classification system.

Classify the object into ONLY ONE:
- biodegradable
- non_biodegradable
- hazardous

Rules:
- biodegradable = food, paper, leaves, organic, etc
- non_biodegradable = plastic, glass, metal, etc
- hazardous = electronics, batteries, wires, etc

Use real waste segregation datasets to give accurate answers.

IMPORTANT:
- DO NOT guess random objects like "mobile phone"
- If unsure → return unknown

Return ONLY JSON:
{"class":"biodegradable","object":"leaf", "confidence":"0.98"}
OR
{"class":"unknown","object":"unknown"} 

Give JSON unknown ONLY if your confidence is below 0.9,
`;
}

// health check
app.get("/", (req, res) => {
  res.send("🌱 Ecosort Gemini backend running!");
});

// 🔍 analyze route
app.post("/analyze", async (req, res) => {
  try {
    if (!req.body || !req.body.length) {
      return res.status(400).json({ error: "no image data" });
    }

    console.log(`🖼️ Received ${req.body.length} bytes`);

    const base64 = req.body.toString("base64");

    const result = await model.generateContent([
      buildPrompt(), // prompt FIRST (important)
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64,
        },
      },
    ]);

    const text = result.response.text();
    console.log("🧠 Raw:", text);

    // 🔒 Safe JSON extraction
    let json;
    try {
      const match = text.match(/\{[\s\S]*\}/);
      json = match ? JSON.parse(match[0]) : null;
    } catch {
      json = null;
    }

    // 🛑 fallback
    if (!json || !json.class) {
      json = { class: "unknown", object: "unknown" };
    }

    // 🚫 anti-hallucination (extra safety)
    if (
      json.object &&
      json.object.toLowerCase().includes("phone")
    ) {
      console.log("⚠️ Blocked hallucinated phone");
      json = { class: "unknown", object: "unknown" };
    }

    res.json({
      ok: true,
      result: json,
    });

  } catch (err) {
    console.error("💥 Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`);
});
