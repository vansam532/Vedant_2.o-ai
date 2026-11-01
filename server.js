import "dotenv/config";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json({ limit: "20mb" }));
app.use(morgan("tiny"));

const limiter = rateLimit({
  windowMs: 60_000, limit: 20,
  standardHeaders: "draft-7", legacyHeaders: false,
  message: { error: "Too many AI requests. Please wait a minute and try again." }
});

async function verifySupabaseUser(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\\s+/i, "");
  if (!token || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return null;
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
  });
  if (!response.ok) return null;
  return await response.json();
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true, name: "VEDANT AI", model: MODEL,
    aiConfigured: Boolean(process.env.GEMINI_API_KEY),
    databaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
  });
});

app.post("/api/ai/chat", limiter, async (req, res) => {
  try {
    const { message, history = [], attachment } = req.body || {};
    if (typeof message !== "string" || !message.trim()) return res.status(400).json({ error: "Please enter a message." });
    if (message.length > 12000) return res.status(413).json({ error: "Message is too long." });
    if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: "Gemini API key is not configured on the server." });

    // If Supabase is configured, require a valid signed-in user for AI access.
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      const user = await verifySupabaseUser(req);
      if (!user?.id) return res.status(401).json({ error: "Please sign in to use VEDANT AI." });
    }

    const contents = [];
    for (const item of Array.isArray(history) ? history.slice(-12) : []) {
      if (!["user", "model"].includes(item.role) || typeof item.text !== "string") continue;
      contents.push({ role: item.role, parts: [{ text: item.text.slice(0, 6000) }] });
    }
    const parts = [{ text: message.trim() }];
    if (attachment?.data && attachment?.mimeType) {
      const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowed.includes(attachment.mimeType)) return res.status(415).json({ error: "Supported attachments: PDF, JPG, PNG, WEBP and GIF." });
      if (attachment.data.length > 18 * 1024 * 1024) return res.status(413).json({ error: "Attachment is too large. Maximum is 13 MB." });
      parts.push({ inlineData: { mimeType: attachment.mimeType, data: attachment.data } });
    }
    contents.push({ role: "user", parts });

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "You are VEDANT AI, a helpful assistant for education, skill development, creativity and business management. Reply in the language used by the user (Hindi or English). Be practical, structured and honest. Never claim certainty when unsure." }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      console.error("Gemini API error:", payload?.error?.message || response.status);
      return res.status(response.status === 429 ? 429 : 502).json({ error: payload?.error?.message || "AI provider request failed." });
    }
    const reply = payload?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim();
    if (!reply) return res.status(502).json({ error: "AI returned an empty response. Please try again." });
    res.json({ reply, model: MODEL });
  } catch (error) {
    console.error("AI route error:", error?.message || error);
    res.status(500).json({ error: "Unexpected server error. Please try again." });
  }
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));
} else {
  app.get("/", (_req, res) => res.send("VEDANT AI API is running. Start Vite with `npm run dev` for the app."));
}
app.listen(PORT, () => console.log(`VEDANT AI server listening on ${PORT}`));
