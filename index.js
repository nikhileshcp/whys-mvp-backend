import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import OpenAI from "openai";
import cors from "cors";

dotenv.config();

// Path fix for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup
const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Multer config (store file in memory)
const upload = multer({ storage: multer.memoryStorage() });

// POST /analyze → receives audio file, returns transcript + inference
app.post("/analyze", upload.single("audio"), async (req, res) => {
  try {
    console.log("🚀 File received from frontend");

    if (!req.file) {
      return res.status(400).json({ error: "No audio file uploaded" });
    }

    // Save buffer to temp file
    const tempPath = path.join(__dirname, "temp_audio.webm");
    fs.writeFileSync(tempPath, req.file.buffer);

    // Step 1: Transcribe with Whisper
    const transcription = await openai.audio.translations.create({
      file: fs.createReadStream(tempPath),
      model: "whisper-1",
    });

    const text = transcription.text;
    console.log("📝 Transcription complete");

    // Step 2: Emotion/Behavior Analysis
    const analysis = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `
You are an expert conversation analyst trained in psychotherapy and emotional intelligence.

Your job: Analyze the provided transcript and produce insights in this **specific structured format**:

🔍 Blindspots Detected:
- [List the main emotional blindspots or unhelpful thinking patterns. 2–5 bullet points.]

💬 Key Quotes:
- "[Direct quote from transcript showing the blindspot]"
- "[Another direct quote...]"

🧠 Interpretation:
[Write a short paragraph explaining the deeper meaning, hidden fears, or needs driving the speaker's behavior. Be concise but insightful.]

Do NOT include anything else. Stick exactly to this format.
          `,
        },
        { role: "user", content: text },
      ],
    });

    // Send result
    res.json({
      transcript: text,
      emotions: analysis.choices[0].message.content,
    });

    fs.unlinkSync(tempPath); // delete temp file
    console.log("🧹 Temp file deleted");
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({
      error: "Something went wrong",
      details: err.message || err,
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
