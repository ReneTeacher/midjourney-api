import { Midjourney } from "midjourney";
import express from "express";

const app = express();
app.use(express.json());

let client;
let clientReady = false;
let initError = null;

// Store last result for upscaling/variations
let lastResult = null;

async function testDiscordConnection() {
  try {
    console.log("🔍 Testing Discord connection...");
    
    const response = await fetch(`https://discord.com/api/v9/users/@me`, {
      headers: {
        'Authorization': process.env.DISCORD_TOKEN
      }
    });
    
    if (response.ok) {
      const userData = await response.json();
      console.log("✅ Discord token valid, user:", userData.username);
      return true;
    } else {
      console.log("❌ Discord token invalid:", response.status);
      return false;
    }
  } catch (error) {
    console.log("❌ Discord connection error:", error.message);
    return false;
  }
}

async function init() {
  try {
    console.log("Initializing Midjourney client...");
    console.log("SERVER_ID:", process.env.SERVER_ID);
    console.log("CHANNEL_ID:", process.env.CHANNEL_ID);
    console.log("DISCORD_TOKEN:", process.env.DISCORD_TOKEN ? "set (length: " + process.env.DISCORD_TOKEN.length + ")" : "NOT SET");
    
    const discordOk = await testDiscordConnection();
    if (!discordOk) {
      initError = "Discord token invalid or expired";
      console.error("❌ Discord connection failed");
      return;
    }
    
    client = new Midjourney({
      ServerId: process.env.SERVER_ID,
      ChannelId: process.env.CHANNEL_ID,
      SalaiToken: process.env.DISCORD_TOKEN,
      Debug: false,
      Ws: true,
    });
    
    console.log("⏳ Calling client.init()...");
    await client.init();
    clientReady = true;
    console.log("✅ Midjourney client initialized successfully!");
  } catch (error) {
    console.error("❌ Midjourney init error:", error.message);
    initError = error.message;
  }
}

init();

// ===== Routes =====

app.get("/", (req, res) => {
  res.json({ 
    status: clientReady ? "ok" : "error", 
    message: clientReady ? "Midjourney API ready" : "Client not ready",
    error: initError
  });
});

app.get("/health", (req, res) => {
  res.json({ 
    clientReady, 
    initError,
    lastResult: lastResult ? {
      id: lastResult.id,
      prompt: lastResult.prompt,
      options: lastResult.options?.map(o => o.label)
    } : null
  });
});

// 🎨 Generate new image
app.post("/imagine", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  if (!client || !clientReady) {
    return res.status(503).json({ error: "Client not ready", initError });
  }

  try {
    console.log("🎨 Generating:", prompt);
    const result = await client.Imagine(prompt);

    if (!result) {
      return res.status(500).json({ error: "No result from Midjourney" });
    }

    // Store for upscaling/variations
    lastResult = result;

    res.json({
      id: result.id,
      prompt: result.prompt,
      uri: result.uri,
      progress: result.progress,
      options: result.options?.map(o => ({ label: o.label, custom: o.custom })),
      message: "Use /upscale or /variation to process further"
    });
  } catch (error) {
    console.error("❌ Imagine error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ⬆️ Upscale (U1, U2, U3, U4)
app.post("/upscale", async (req, res) => {
  const { index = 1 } = req.body; // 1, 2, 3, or 4
  
  if (!client || !clientReady) {
    return res.status(503).json({ error: "Client not ready" });
  }

  if (!lastResult || !lastResult.options) {
    return res.status(400).json({ error: "No previous result. Use /imagine first." });
  }

  const upscaleOption = lastResult.options.find(o => o.label === `U${index}`);
  if (!upscaleOption) {
    return res.status(400).json({ error: `U${index} not found` });
  }

  try {
    console.log(`⬆️ Upscaling U${index}...`);
    const result = await client.Custom({
      msgId: lastResult.id,
      flags: lastResult.flags,
      customId: upscaleOption.custom,
      content: lastResult.prompt
    });

    lastResult = result;

    res.json({
      id: result.id,
      uri: result.uri,
      progress: result.progress,
      options: result.options?.map(o => ({ label: o.label, custom: o.custom })),
      message: `U${index} complete! Use /vary or /upscale again.`
    });
  } catch (error) {
    console.error("❌ Upscale error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 🔄 Variation (V1, V2, V3, V4)
app.post("/variation", async (req, res) => {
  const { index = 1 } = req.body; // 1, 2, 3, or 4
  
  if (!client || !clientReady) {
    return res.status(503).json({ error: "Client not ready" });
  }

  if (!lastResult || !lastResult.options) {
    return res.status(400).json({ error: "No previous result. Use /imagine first." });
  }

  const variationOption = lastResult.options.find(o => o.label === `V${index}`);
  if (!variationOption) {
    return res.status(400).json({ error: `V${index} not found` });
  }

  try {
    console.log(`🔄 Creating variation V${index}...`);
    const result = await client.Custom({
      msgId: lastResult.id,
      flags: lastResult.flags,
      customId: variationOption.custom,
      content: lastResult.prompt
    });

    lastResult = result;

    res.json({
      id: result.id,
      uri: result.uri,
      progress: result.progress,
      options: result.options?.map(o => ({ label: o.label, custom: o.custom })),
      message: `V${index} complete! Use /upscale to enlarge.`
    });
  } catch (error) {
    console.error("❌ Variation error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 🔁 Reroll (generate again)
app.post("/reroll", async (req, res) => {
  if (!client || !clientReady) {
    return res.status(503).json({ error: "Client not ready" });
  }

  if (!lastResult) {
    return res.status(400).json({ error: "No previous result. Use /imagine first." });
  }

  try {
    console.log("🔁 Rerolling...");
    const rerollOption = lastResult.options?.find(o => o.label.includes("🔄"));
    if (!rerollOption) {
      return res.status(400).json({ error: "Reroll option not found" });
    }
    
    const result = await client.Custom({
      msgId: lastResult.id,
      flags: lastResult.flags,
      customId: rerollOption.custom,
      content: lastResult.prompt
    });

    lastResult = result;

    res.json({
      id: result.id,
      uri: result.uri,
      progress: result.progress,
      options: result.options?.map(o => ({ label: o.label, custom: o.custom })),
      message: "Rerolled! Use /upscale or /variation."
    });
  } catch (error) {
    console.error("❌ Reroll error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Midjourney API running on port ${PORT}`);
  console.log(`📝 Endpoints:`);
  console.log(`   POST /imagine   - Generate new image`);
  console.log(`   POST /upscale   - Upscale (U1-U4)`);
  console.log(`   POST /variation - Create variation (V1-V4)`);
  console.log(`   POST /reroll    - Regenerate`);
});
