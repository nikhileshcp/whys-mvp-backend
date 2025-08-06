import express from "express";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/analyze", async (req, res) => {
  try {
    console.log("🚀 Received POST /analyze");

    const { youtubeUrl } = req.body;
    if (!youtubeUrl) {
      console.warn("⚠️ Missing YouTube URL in request body");
      return res.status(400).json({ error: "YouTube URL is required" });
    }

    const audioPath = path.join(process.cwd(), "audio.webm");
    console.log("📥 Audio path set to:", audioPath);

    console.log("📡 Starting yt-dlp download...");
    await new Promise((resolve, reject) => {
      const ytdlp = spawn("yt-dlp", [
        "--cookies", "cookies.txt",
        "-f", "bestaudio[ext=webm]",
        "--merge-output-format", "webm",
        "-o", audioPath,
        youtubeUrl
      ]);

      ytdlp.stdout.on("data", (data) => {
        console.log(`yt-dlp: ${data}`);
      });

      ytdlp.stderr.on("data", (data) => {
        console.error(`yt-dlp error: ${data}`);
      });

      ytdlp.on("close", (code) => {
        if (code === 0) {
          console.log("✅ yt-dlp finished successfully");
          resolve();
        } else {
          console.error(`❌ yt-dlp exited with code ${code}`);
          reject(`yt-dlp exited with code ${code}`);
        }
      });
    });

    console.log("🔊 Starting transcription...");
    const transcription = await openai.audio.translations.create({
      file: fs.createReadStream(audioPath),
      model: "whisper-1",
    });
    const text = transcription.text;
    console.log("📝 Transcription complete");

    console.log("🧠 Starting emotion analysis...");
    const emotionAnalysis = await openai.chat.completions.create({
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
        `
        },
        { role: "user", content: text },
      ],
    });
    console.log("📊 Emotion analysis complete");

    // 4️⃣ Send result back to client
    res.json({
      transcript: text,
      emotions: emotionAnalysis.choices[0].message.content,
    });

    console.log("📤 Response sent to client");

    // 5️⃣ Clean up
    fs.unlinkSync(audioPath);
    console.log("🧹 Temporary audio file deleted");

  } catch (err) {
    console.error("❌ An error occurred:", err);
    res.status(500).json({ error: "Something went wrong", details: err.message || err });
  }
});
