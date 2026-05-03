import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// raw JPEG input (same as your ESP)
app.use(express.raw({ type: "image/jpeg", limit: "10mb" }));

// 🔥 STRICT PROMPT (key to accuracy)
function buildPrompt() {
  return `
You are a STRICT waste classification system.

Classify the object into ONLY ONE:
- biodegradable
- non_biodegradable
- hazardous

Rules:
- biodegradable = food, paper, leaves
- non_biodegradable = plastic, glass, metal
- hazardous = electronics, batteries, wires

IMPORTANT:
- DO NOT guess common objects like "mobile phone"
- If not clearly visible → return unknown

Return ONLY JSON:
{"class":"biodegradable","object":"leaf"}
OR
{"class":"unknown","object":"unknown"}
`;
}

app.get("/", (req, res) => {
  res.send("🌱 Ecosort (ChatGPT backend) is running!");
});

app.post("/analyze", async (req, res) => {
  try {
    if (!req.body || !req.body.length) {
      return res.status(400).json({ error: "no image data" });
    }

    const base64 = req.body.toString("base64");
    console.log(`🖼️ Received ${req.body.length} bytes`);

    // 🧠 OpenAI Vision call
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini", // fast + good for vision
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildPrompt() },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 100,
    });

    const text = response.choices[0].message.content;
    console.log("🧠 Raw:", text);

    // 🔒 Safe JSON extraction
    let json;
    try {
      const match = text.match(/\{[\s\S]*\}/);
      json = match ? JSON.parse(match[0]) : null;
    } catch {
      json = null;
    }

    // 🛑 Safety fallback
    if (!json || !json.class) {
      json = { class: "unknown", object: "unknown" };
    }

    // 🚫 Anti-hallucination filter
    if (
      json.object &&
      json.object.toLowerCase().includes("phone")
    ) {
      console.log("⚠️ Blocked hallucinated phone");
      json = { class: "unknown", object: "unknown" };
    }

    res.json({ ok: true, result: json });

  } catch (err) {
    console.error("💥 Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () =>
  console.log(`🚀 Server running on ${PORT}`)
);
