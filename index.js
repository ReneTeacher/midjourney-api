import { Midjourney } from "midjourney";
import express from "express";

const app = express();
app.use(express.json());

let client;

async function init() {
  client = new Midjourney({
    ServerId: process.env.SERVER_ID,
    ChannelId: process.env.CHANNEL_ID,
    SalaiToken: process.env.DISCORD_TOKEN,
    Debug: true,
    Ws: true,
  });
  
  await client.init();
  console.log("Midjourney client initialized");
}

init().catch(console.error);

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Midjourney API ready" });
});

app.post("/imagine", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  if (!client) {
    return res.status(503).json({ error: "Client not initialized yet" });
  }

  try {
    console.log("Generating:", prompt);
    const result = await client.Imagine(
      prompt,
      (uri, progress) => {
        console.log("Loading:", uri, "Progress:", progress);
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
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Midjourney API running on port ${PORT}`);
});
