import { Midjourney } from "midjourney";
import express from "express";

const app = express();
app.use(express.json());

let client;
let clientReady = false;
let initError = null;
let lastResult = null;

async function testDiscordConnection() {
  try {
    const response = await fetch(`https://discord.com/api/v9/users/@me`, {
      headers: { 'Authorization': process.env.DISCORD_TOKEN }
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function init() {
  try {
    console.log("Initializing Midjourney client...");
    const discordOk = await testDiscordConnection();
    if (!discordOk) {
      initError = "Discord token invalid";
      return;
    }
    
    client = new Midjourney({
      ServerId: process.env.SERVER_ID,
      ChannelId: process.env.CHANNEL_ID,
      SalaiToken: process.env.DISCORD_TOKEN,
      Debug: false,
      Ws: true,
    });
    
    await client.init();
    clientReady = true;
    console.log("✅ Midjourney client ready!");
  } catch (error) {
    initError = error.message;
  }
}

init();

// Helper: find option by label
function findOption(result, labelPart) {
  return result.options?.find(o => o.label.toLowerCase().includes(labelPart.toLowerCase()));
}

// ===== Routes =====

app.get("/", (req, res) => res.json({ status: clientReady ? "ok" : "error", message: clientReady ? "Ready" : "Not ready", error: initError }));

app.get("/health", (req, res) => res.json({ clientReady, lastResult: lastResult ? { id: lastResult.id, prompt: lastResult.prompt } : null }));

// 🎨 Generate new image
app.post("/imagine", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt required" });
  if (!clientReady) return res.status(503).json({ error: "Client not ready" });

  try {
    const result = await client.Imagine(prompt);
    lastResult = result;
    res.json({ id: result.id, uri: result.uri, progress: result.progress, options: result.options?.map(o => ({ label: o.label, custom: o.custom })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ⬆️ Upscale (U1-U4)
app.post("/upscale", async (req, res) => {
  const { index = 1 } = req.body;
  if (!clientReady) return res.status(503).json({ error: "Not ready" });
  if (!lastResult) return res.status(400).json({ error: "No previous result" });

  const option = findOption(lastResult, `U${index}`);
  if (!option) return res.status(400).json({ error: `U${index} not found` });

  try {
    const result = await client.Custom({ msgId: lastResult.id, flags: lastResult.flags, customId: option.custom, content: lastResult.prompt });
    lastResult = result;
    res.json({ id: result.id, uri: result.uri, progress: result.progress, options: result.options?.map(o => ({ label: o.label, custom: o.custom })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔄 Variation (V1-V4)
app.post("/variation", async (req, res) => {
  const { index = 1 } = req.body;
  if (!clientReady) return res.status(503).json({ error: "Not ready" });
  if (!lastResult) return res.status(400).json({ error: "No previous result" });

  const option = findOption(lastResult, `V${index}`);
  if (!option) return res.status(400).json({ error: `V${index} not found` });

  try {
    const result = await client.Custom({ msgId: lastResult.id, flags: lastResult.flags, customId: option.custom, content: lastResult.prompt });
    lastResult = result;
    res.json({ id: result.id, uri: result.uri, progress: result.progress, options: result.options?.map(o => ({ label: o.label, custom: o.custom })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🎭 Vary Subtle
app.post("/vary-subtle", async (req, res) => {
  if (!clientReady) return res.status(503).json({ error: "Not ready" });
  if (!lastResult) return res.status(400).json({ error: "No previous result" });

  const option = findOption(lastResult, "low_variation");
  if (!option) return res.status(400).json({ error: "Vary option not found" });

  try {
    const result = await client.Custom({ msgId: lastResult.id, flags: lastResult.flags, customId: option.custom, content: lastResult.prompt });
    lastResult = result;
    res.json({ id: result.id, uri: result.uri, progress: result.progress, options: result.options?.map(o => ({ label: o.label, custom: o.custom })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🎭 Vary Strong
app.post("/vary-strong", async (req, res) => {
  if (!clientReady) return res.status(503).json({ error: "Not ready" });
  if (!lastResult) return res.status(400).json({ error: "No previous result" });

  const option = findOption(lastResult, "high_variation");
  if (!option) return res.status(400).json({ error: "Vary option not found" });

  try {
    const result = await client.Custom({ msgId: lastResult.id, flags: lastResult.flags, customId: option.custom, content: lastResult.prompt });
    lastResult = result;
    res.json({ id: result.id, uri: result.uri, progress: result.progress, options: result.options?.map(o => ({ label: o.label, custom: o.custom })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔍 Zoom Out 2x
app.post("/zoom-2x", async (req, res) => {
  if (!clientReady) return res.status(503).json({ error: "Not ready" });
  if (!lastResult) return res.status(400).json({ error: "No previous result" });

  const option = findOption(lastResult, "zoom out 2x");
  if (!option) return res.status(400).json({ error: "Zoom 2x not found" });

  try {
    const result = await client.Custom({ msgId: lastResult.id, flags: lastResult.flags, customId: option.custom, content: lastResult.prompt });
    lastResult = result;
    res.json({ id: result.id, uri: result.uri, progress: result.progress, options: result.options?.map(o => ({ label: o.label, custom: o.custom })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔍 Zoom Out 1.5x
app.post("/zoom-1-5x", async (req, res) => {
  if (!clientReady) return res.status(503).json({ error: "Not ready" });
  if (!lastResult) return res.status(400).json({ error: "No previous result" });

  const option = findOption(lastResult, "zoom out 1.5");
  if (!option) return res.status(400).json({ error: "Zoom 1.5x not found" });

  try {
    const result = await client.Custom({ msgId: lastResult.id, flags: lastResult.flags, customId: option.custom, content: lastResult.prompt });
    lastResult = result;
    res.json({ id: result.id, uri: result.uri, progress: result.progress, options: result.options?.map(o => ({ label: o.label, custom: o.custom })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ↔️ Pan Left
app.post("/pan-left", async (req, res) => {
  if (!clientReady) return res.status(503).json({ error: "Not ready" });
  if (!lastResult) return res.status(400).json({ error: "No previous result" });

  const option = findOption(lastResult, "pan_left");
  if (!option) return res.status(400).json({ error: "Pan left not found" });

  try {
    const result = await client.Custom({ msgId: lastResult.id, flags: lastResult.flags, customId: option.custom });
    lastResult = result;
    res.json({ id: result.id, uri: result.uri, progress: result.progress, options: result.options?.map(o => ({ label: o.label, custom: o.custom })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ↔️ Pan Right
app.post("/pan-right", async (req, res) => {
  if (!clientReady) return res.status(503).json({ error: "Not ready" });
  if (!lastResult) return res.status(400).json({ error: "No previous result" });

  const option = findOption(lastResult, "pan_right");
  if (!option) return res.status(400).json({ error: "Pan right not found" });

  try {
    const result = await client.Custom({ msgId: lastResult.id, flags: lastResult.flags, customId: option.custom });
    lastResult = result;
    res.json({ id: result.id, uri: result.uri, progress: result.progress, options: result.options?.map(o => ({ label: o.label, custom: o.custom })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ↕️ Pan Up
app.post("/pan-up", async (req, res) => {
  if (!clientReady) return res.status(503).json({ error: "Not ready" });
  if (!lastResult) return res.status(400).json({ error: "No previous result" });

  const option = findOption(lastResult, "pan_up");
  if (!option) return res.status(400).json({ error: "Pan up not found" });

  try {
    const result = await client.Custom({ msgId: lastResult.id, flags: lastResult.flags, customId: option.custom });
    lastResult = result;
    res.json({ id: result.id, uri: result.uri, progress: result.progress, options: result.options?.map(o => ({ label: o.label, custom: o.custom })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ↕️ Pan Down
app.post("/pan-down", async (req, res) => {
  if (!clientReady) return res.status(503).json({ error: "Not ready" });
  if (!lastResult) return res.status(400).json({ error: "No previous result" });

  const option = findOption(lastResult, "pan_down");
  if (!option) return res.status(400).json({ error: "Pan down not found" });

  try {
    const result = await client.Custom({ msgId: lastResult.id, flags: lastResult.flags, customId: option.custom });
    lastResult = result;
    res.json({ id: result.id, uri: result.uri, progress: result.progress, options: result.options?.map(o => ({ label: o.label, custom: o.custom })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🎬 Animate (High Motion)
app.post("/animate-high", async (req, res) => {
  if (!clientReady) return res.status(503).json({ error: "Not ready" });
  if (!lastResult) return res.status(400).json({ error: "No previous result" });

  const option = findOption(lastResult, "animate_high");
  if (!option) return res.status(400).json({ error: "Animate not found" });

  try {
    const result = await client.Custom({ msgId: lastResult.id, flags: lastResult.flags, customId: option.custom });
    lastResult = result;
    res.json({ id: result.id, uri: result.uri, progress: result.progress, options: result.options?.map(o => ({ label: o.label, custom: o.custom })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🎬 Animate (Low Motion)
app.post("/animate-low", async (req, res) => {
  if (!clientReady) return res.status(503).json({ error: "Not ready" });
  if (!lastResult) return res.status(400).json({ error: "No previous result" });

  const option = findOption(lastResult, "animate_low");
  if (!option) return res.status(400).json({ error: "Animate not found" });

  try {
    const result = await client.Custom({ msgId: lastResult.id, flags: lastResult.flags, customId: option.custom });
    lastResult = result;
    res.json({ id: result.id, uri: result.uri, progress: result.progress, options: result.options?.map(o => ({ label: o.label, custom: o.custom })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔁 Reroll
app.post("/reroll", async (req, res) => {
  if (!clientReady) return res.status(503).json({ error: "Not ready" });
  if (!lastResult) return res.status(400).json({ error: "No previous result" });

  const option = findOption(lastResult, "🔄");
  if (!option) return res.status(400).json({ error: "Reroll not found" });

  try {
    const result = await client.Custom({ msgId: lastResult.id, flags: lastResult.flags, customId: option.custom, content: lastResult.prompt });
    lastResult = result;
    res.json({ id: result.id, uri: result.uri, progress: result.progress, options: result.options?.map(o => ({ label: o.label, custom: o.custom })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Midjourney API running on port ${PORT}`);
});
