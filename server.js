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

const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const REQUEST_TIMEOUT = 60000;

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json({ limit: "20mb" }));
app.use(morgan("tiny"));

const limiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many AI requests. Please wait a minute." }
});

async function verifySupabaseUser(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

  if (!token || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return null;
  }

  const response = await fetch(
    `${process.env.SUPABASE_URL}/auth/v1/user`,
    {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`
      },
      signal: AbortSignal.timeout(10000)
    }
  );

  if (!response.ok) return null;
  return await response.json();
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    name: "VEDANT AI",
    provider: "OpenAI",
    model: MODEL,
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    databaseConfigured: Boolean(
      process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
    )
  });
});

app.post("/api/ai/chat", limiter, async (req, res) => {
  try {
    const { message, history = [], attachment } = req.body || {};

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Please enter a message." });
    }

    if (message.length > 12000) {
      return res.status(413).json({ error: "Message is too long." });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: "OpenAI API key is not configured on the server."
      });
    }

    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      const user = await verifySupabaseUser(req);

      if (!user?.id) {
        return res.status(401).json({
          error: "Please sign in to use VEDANT AI."
        });
      }
    }

    const input = [];

    for (const item of Array.isArray(history) ? history.slice(-10) : []) {
      if (
        !["user", "assistant"].includes(item.role) ||
        typeof item.text !== "string"
      ) continue;

      input.push({
        role: item.role,
        content: [{
          type: "input_text",
          text: item.text.slice(0, 4000)
        }]
      });
    }

    const content = [{
      type: "input_text",
      text: message.trim()
    }];

    if (attachment?.data && attachment?.mimeType) {
      const allowed = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif"
      ];

      if (!allowed.includes(attachment.mimeType)) {
        return res.status(415).json({
          error: "Supported attachments: PDF, JPG, PNG, WEBP and GIF."
        });
      }

      if (
        typeof attachment.data !== "string" ||
        attachment.data.length > 18 * 1024 * 1024
      ) {
        return res.status(413).json({
          error: "Attachment is too large. Maximum is 18 MB."
        });
      }

      const dataUrl = `data:${attachment.mimeType};base64,${attachment.data}`;

      if (attachment.mimeType === "application/pdf") {
        content.push({
          type: "input_file",
          filename: "attachment.pdf",
          file_data: dataUrl
        });
      } else {
        content.push({
          type: "input_image",
          image_url: dataUrl,
          detail: "auto"
        });
      }
    }

    input.push({
      role: "user",
      content
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    let response;

    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: MODEL,
          instructions:
            "You are VEDANT AI, a helpful assistant for education, skill development, creativity and business management. Reply in the language used by the user (Hindi or English). Be practical, structured and honest. Never claim certainty when unsure.",
          input,
          max_output_tokens: 2048
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    const payload = await response.json();

    if (!response.ok) {
      console.error(
        "OpenAI API error:",
        payload?.error?.message || response.status
      );

      return res.status(response.status === 429 ? 429 : 502).json({
        error: payload?.error?.message || "OpenAI request failed."
      });
    }

    const reply = (payload.output || [])
      .flatMap(item => item.content || [])
      .filter(item => item.type === "output_text")
      .map(item => item.text || "")
      .join("")
      .trim();

    if (!reply) {
      return res.status(502).json({
        error: "AI returned an empty response. Please try again."
      });
    }

    return res.json({ reply, model: MODEL });

  } catch (error) {
    console.error("AI route error:", error?.message || error);

    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      return res.status(504).json({
        error: "AI response timed out. Please try again."
      });
    }

    return res.status(500).json({
      error: "Unexpected server error. Please try again."
    });
  }
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "dist")));

  app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.send("VEDANT AI API is running.");
  });
}

app.listen(PORT, () => {
  console.log(`VEDANT AI server listening on ${PORT}`);
});
