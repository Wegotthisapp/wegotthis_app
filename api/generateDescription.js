export default async function handler(req, res) {
  try {
    const { title, category } = req.body;

    const prompt = `
      Suggest a short, friendly task description for:
      Title: ${title}
      Category: ${category}
      Max 25 words.
    `;

    const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await apiRes.json();
    const suggestion = data.choices?.[0]?.message?.content?.trim() || "";

    res.status(200).json({ description: suggestion });
  
  } catch (err) {
    console.error("AI error", err);
    res.status(500).json({ error: "AI generation failed" });
  }
}
