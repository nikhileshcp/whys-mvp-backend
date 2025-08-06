import express from "express";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();
const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/analyze", async (req, res) => {
  try {
    const { youtubeUrl } = req.body;
    if (!youtubeUrl) {
      return res.status(400).json({ error: "YouTube URL is required" });
    }

    // Always use .webm for stable Whisper support without ffmpeg
    const audioPath = path.join(process.cwd(), "audio.webm");

    // 1️⃣ Download audio using yt-dlp.exe
    await new Promise((resolve, reject) => {
      const ytdlp = spawn("./yt-dlp.exe", [
        "-f", "bestaudio[ext=webm]", // best quality audio in webm format
        "--merge-output-format", "webm", // ensure final file is .webm
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
        if (code === 0) resolve();
        else reject(`yt-dlp exited with code ${code}`);
      });
    });

    // 2️⃣ Transcribe audio (Whisper supports .webm)
    // const transcription = await openai.audio.transcriptions.create({
    //   file: fs.createReadStream(audioPath),
    //   model: "whisper-1",
    // });
    const transcription = await openai.audio.translations.create({
        file: fs.createReadStream(audioPath),
        model: "whisper-1",
        });
    const text = transcription.text;

    // 3️⃣ Analyze emotions
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

    // 4️⃣ Send result back to client
    res.json({
      transcript: text,
      emotions: emotionAnalysis.choices[0].message.content,
    });

    // 5️⃣ Clean up temporary audio file
    fs.unlinkSync(audioPath);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(5000, () => {
  console.log("✅ Server running on port 5000");
});
