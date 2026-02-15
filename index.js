import { Midjourney } from "midjourney";
import express from "express";

const app = express();
app.use(express.json());

let client;
let clientReady = false;
let initError = null;

async function init() {
  try {
    console.log("Initializing Midjourney client...");
    console.log("SERVER_ID:", process.env.SERVER_ID);
    console.log("CHANNEL_ID:", process.env.CHANNEL_ID);
    console.log("DISCORD_TOKEN:", process.env.DISCORD_TOKEN ? "set" : "NOT SET");
    
    client = new Midjourney({
      ServerId: process.env.SERVER_ID,
      ChannelId: process.env.CHANNEL_ID,
      SalaiToken: process.env.DISCORD_TOKEN,
      Debug: true,
      Ws: false,  // Disable WS, use polling instead
    });
    
    await client.init();
    clientReady = true;
    console.log("✅ Midjourney client initialized successfully!");
  } catch (error) {
    console.error("❌ Midjourney init error:", error.message);
    initError = error.message;
    
    // Retry once after 3 seconds
    setTimeout(async () => {
      try {
        console.log("🔄 Retrying initialization...");
        client = new Midjourney({
          ServerId: process.env.SERVER_ID,
          ChannelId: process.env.CHANNEL_ID,
          SalaiToken: process.env.DISCORD_TOKEN,
          Debug: true,
          Ws: false,
        });
        await client.init();
        clientReady = true;
        console.log("✅ Midjourney client initialized on retry!");
      } catch (retryError) {
        console.error("❌ Retry also failed:", retryError.message);
      }
    }, 3000);
  }
}

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

  // Wait for client to be ready
  let retries = 0;
  while (!clientReady && retries < 10) {
    await new Promise(r => setTimeout(r, 1000));
    retries++;
  }
  
  if (!clientReady) {
    return res.status(503).json({ error: "Client not ready yet", initError });
  }

  try {
    console.log("🎨 Generating:", prompt);
    const result = await client.Imagine(
      prompt,
      (uri, progress) => {
        console.log("⏳ Loading:", uri, "Progress:", progress);
      }
    );

    if (!result) {
      return res.status(500).json({ error: "No result from Midjourney" });
    }

    res.json({
      id: result.id,
      prompt: result.prompt,
      uri: result.uri,
      progress: result.progress,
      options: result.options?.map(o => ({ label: o.label, custom: o.custom })),
    });
  } catch (error) {
    console.error("❌ Imagine error:", error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Midjourney API running on port ${PORT}`);
});
