// Allow calls from the Capacitor mobile app (iOS: capacitor://localhost,
// Android: https://localhost) as well as the web app itself.
const ALLOWED_ORIGINS = [
  "capacitor://localhost",
  "https://localhost",
  "http://localhost",
  "https://www.jagodoo.com",
  "https://jagodoo.com",
];

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const { title, category, city } = req.body;

    const prompt = `
      Suggest a fair EUR price range for this task.
      Title: ${title || "Unknown"}
      Category: ${category || "Unknown"}
      City: ${city || "Unknown"}
      Respond ONLY with something like: "30–50 EUR".
    `;

    const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await apiRes.json();
    const suggestion = data.choices?.[0]?.message?.content?.trim() || "";

    res.status(200).json({ price: suggestion });
  } catch (err) {
    console.error("AI price error", err);
    res.status(500).json({ error: "AI price suggestion failed" });
  }
}
