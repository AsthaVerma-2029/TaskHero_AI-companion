import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import http from "http";
import { WebSocketServer } from "ws";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini client lazily to avoid crashing on startup if key is missing
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("WARNING: GEMINI_API_KEY environment variable is not set!");
    }
    aiClient = new GoogleGenAI({
      apiKey: key || "MOCK_KEY_FALLBACK",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// ----------------------------------------------------
// 🚀 API ROUTE: TASK BREAKDOWN (GEMINI 3.5 FLASH)
// ----------------------------------------------------
app.post("/api/gemini/breakdown", async (req, res) => {
  try {
    const { title, description, difficulty } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const ai = getGeminiClient();
    const prompt = `You are TaskHero productivity coach.
Analyze this high-level goal and break it down into 4 to 6 highly actionable, small, specific tasks/subtasks that the user can execute right away to avoid last-minute rush and procrastination.
Goal: "${title}"
Description: "${description || 'Not provided'}"
Difficulty Level: "${difficulty || 'Medium'}"

Generate the subtasks in a strict JSON array format. Each subtask MUST have:
1. "title": string (very specific and action-oriented, e.g. "Draft the first 2 slides" rather than "Do slides")
2. "dueDateOffset": number (suggested number of days from today to complete this subtask, e.g. 1, 2, 3)

Provide only the raw JSON array. No markdown code blocks, no additional explanations outside the array.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from Gemini");
    }

    // Parse the JSON list
    const subtasks = JSON.parse(text);
    return res.json({ subtasks });
  } catch (err: any) {
    console.error("Error in task breakdown:", err);
    return res.status(500).json({ error: err.message || "Failed to breakdown task" });
  }
});

// ----------------------------------------------------
// 💬 API ROUTE: AI COMPANION CHAT (GEMINI 3.5 FLASH)
// ----------------------------------------------------
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const ai = getGeminiClient();

    // Reconstruct chat with history if provided
    const chat = ai.chats.create({
      model: "gemini-3.5-flash",
      config: {
        systemInstruction: `You are TaskHero, an ultra-supportive, direct-talking productivity companion.
Your mission is to help students, professionals, and entrepreneurs conquer procrastination and finish tasks before deadlines.
Give highly actionable advice, speak like a warm coach (high energy, clear objectives), and call out procrastination patterns gently but firmly.
Keep responses concise, conversational, and split into small paragraphs or bullet points.`,
      },
    });

    // Optionally load history (if available) - standard chats.create doesn't have a direct history loader easily,
    // so we can prepend history in system instruction or feed them.
    // Standard chats in @google/genai supports:
    // const chat = ai.chats.create({ model, history: [...] })
    // Let's check: Yes, history can be fed, but we can also just prompt standard message.
    const response = await chat.sendMessage({ message });
    return res.json({ text: response.text });
  } catch (err: any) {
    console.error("Error in AI companion chat:", err);
    return res.status(500).json({ error: err.message || "Chat failed" });
  }
});

// ----------------------------------------------------
// 🎙️ API ROUTE: TEXT-TO-SPEECH (GEMINI 3.1 FLASH TTS)
// ----------------------------------------------------
app.post("/api/gemini/tts", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: text,
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Zephyr", // Prebuilt voices: puck, Aoede, Kore, Fenrir, Zephyr
            },
          },
        },
      },
    });

    const candidate = response.candidates?.[0];
    const part = candidate?.content?.parts?.[0];
    const base64Audio = part?.inlineData?.data;
    const mimeType = part?.inlineData?.mimeType || "audio/mp3";

    if (!base64Audio) {
      throw new Error("TTS generation did not return any audio data");
    }

    return res.json({ audio: base64Audio, mimeType });
  } catch (err: any) {
    console.error("Error in TTS:", err);
    return res.status(500).json({ error: err.message || "Failed to generate speech" });
  }
});

// Create HTTP server
const server = http.createServer(app);

// ----------------------------------------------------
// 🎙️ WEBSOCKET ENDPOINT: AI LIVE TALK (GEMINI 3.1 LIVE)
// ----------------------------------------------------
const wss = new WebSocketServer({ server, path: "/api/live" });

wss.on("connection", async (clientWs) => {
  console.log("Client connected to Live API WebSocket");
  let session: any = null;

  try {
    const ai = getGeminiClient();
    
    // Connect to the Live API session using the SDK
    session = await ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: ["AUDIO" as any],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
        },
        systemInstruction: "You are TaskHero, a warm, motivating, high-energy voice assistant. Your goal is to guide the user in planning their day, crushing procrastination, and getting motivated. Speak briefly, encouragingly, and in natural conversational fragments.",
      },
      callbacks: {
        onmessage: (message) => {
          // Handle audio
          const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audio) {
            clientWs.send(JSON.stringify({ audio }));
          }
          // Handle transcription if available
          const text = message.serverContent?.modelTurn?.parts?.[0]?.text;
          if (text) {
            clientWs.send(JSON.stringify({ text }));
          }
          // Handle interruption
          if (message.serverContent?.interrupted) {
            clientWs.send(JSON.stringify({ interrupted: true }));
          }
        },
      },
    });

    clientWs.on("message", (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.audio && session) {
          session.sendRealtimeInput({
            audio: { data: parsed.audio, mimeType: "audio/pcm;rate=16000" },
          });
        }
      } catch (err) {
        console.error("Error sending user audio to Gemini Live session:", err);
      }
    });

    clientWs.on("close", () => {
      console.log("Client disconnected from Live API WebSocket");
      if (session) {
        session.close();
      }
    });

  } catch (err) {
    console.error("Error starting Live API session:", err);
    clientWs.send(JSON.stringify({ error: "Failed to connect to AI voice session" }));
    clientWs.close();
  }
});

// ----------------------------------------------------
// 🌐 VITE MIDDLEWARE & STATIC SERVING CONFIG
// ----------------------------------------------------
async function startApp() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[TaskHero Server] Running on http://localhost:${PORT}`);
  });
}

startApp().catch((err) => {
  console.error("Failed to start server:", err);
});
