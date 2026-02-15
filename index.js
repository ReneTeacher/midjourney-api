import { Midjourney } from "midjourney";
import express from "express";

const client = new Midjourney({
  ServerId: process.env.SERVER_ID || "1448339490895560907",
  ChannelId: process.env.CHANNEL_ID || "1448339661192826961",
  SalaiToken: process.env.SALAI_TOKEN || "Nzg2NjA5NDA4ODM4MjA1NTIx.G0qAjY.4DO5cOsjMCw1aDfiA6hwADwhAK5h3M0l0u4__A",
  Debug: true,
  Ws: true,
});

await client.init();

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Midjourney API ready" });
});

app.post("/imagine", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
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
