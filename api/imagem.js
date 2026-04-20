export default async function handler(req, res) {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ erro: "Sem prompt" });
  }

  try {
    // 🔹 1. cria a geração
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        version: "stability-ai/sdxl", // modelo
        input: {
          prompt: prompt,
          width: 1024,
          height: 1024
        }
      })
    });

    let data = await response.json();

    // 🔹 2. esperar resultado
    while (data.status !== "succeeded" && data.status !== "failed") {
      await new Promise(r => setTimeout(r, 1500));

      const check = await fetch(data.urls.get, {
        headers: {
          "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`
        }
      });

      data = await check.json();
    }

    if (data.status === "succeeded") {
      return res.json({ imagem: data.output[0] });
    } else {
      return res.status(500).json({ erro: "Erro ao gerar imagem" });
    }

  } catch (err) {
    return res.status(500).json({ erro: "Erro no servidor" });
  }
}
