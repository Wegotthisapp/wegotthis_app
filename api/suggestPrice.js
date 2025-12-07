export default async function handler(req, res) {
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
