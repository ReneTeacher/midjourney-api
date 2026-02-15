import { Midjourney } from "midjourney";
import express from "express";

const app = express();
app.use(express.json());

let client;
let clientReady = false;
let initError = null;

// Test Discord connection first
async function testDiscordConnection() {
  try {
    console.log("🔍 Testing Discord connection...");
    
    // Test with a simple HTTP request first
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
    
    // Test Discord connection first
    const discordOk = await testDiscordConnection();
    if (!discordOk) {
      initError = "Discord token invalid or expired";
      console.error("❌ Discord connection failed");
      return;
    }
    
    // Try with minimal config
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
    console.error("Stack:", error.stack);
    initError = error.message;
  }
}

// Start init but don't wait
init();

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
    env: {
      hasServerId: !!process.env.SERVER_ID,
      hasChannelId: !!process.env.CHANNEL_ID,
      hasDiscordToken: !!process.env.DISCORD_TOKEN,
      tokenLength: process.env.DISCORD_TOKEN?.length || 0
    }
  });
});

app.post("/imagine", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  if (!client) {
    return res.status(503).json({ error: "Client not initialized" });
  }

  if (!clientReady) {
    return res.status(503).json({ error: "Client not ready yet", initError });
  }

  try {
    console.log("🎨 Generating:", prompt);
    const result = await client.Imagine(prompt);

    if (!result) {
      return res.status(500).json({ error: "No result from Midjourney" });
    }

    res.json({
      id: result.id,
      prompt: result.prompt,
      uri: result.uri,
      progress: result.progress,
    });
  } catch (error) {
    console.error("❌ Imagine error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Midjourney API running on port ${PORT}`);
});
