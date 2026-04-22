export default async function handler(req, res) {
  try {
    console.log("🔥 entrou na API");

    const { prompt } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ erro: "Sem prompt" });
    }

    const token = process.env.REPLICATE_API_TOKEN;

    if (!token) {
      return res.status(500).json({ erro: "Token não encontrado" });
    }

    console.log("🔥 token OK");

    const response = await fetch(
      "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions",
      {
        method: "POST",
        headers: {
          "Authorization": `Token ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          input: {
            prompt: prompt
          }
        })
      }
    );

    const text = await response.text();
    console.log("🔥 resposta replicate:", text);

    return res.status(200).json({ debug: text });

  } catch (err) {
    console.error("💥 ERRO:", err);
    return res.status(500).json({ erro: err.message });
  }
}
