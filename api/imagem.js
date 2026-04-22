export default async function handler(req, res) {
  try {
    const { prompt } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ erro: "Sem prompt" });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return res.status(500).json({ erro: "Token não configurado" });
    }

    // 🎨 cria imagem
    const create = await fetch(
      "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions",
      {
        method: "POST",
        headers: {
          "Authorization": `Token ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          input: {
            prompt: `${prompt}, black and white coloring page, thick lines, no shading`,
            width: 1024,
            height: 1024
          }
        })
      }
    );

    let data = await create.json();

    // ⏳ polling
    let tentativas = 0;
    while (data.status !== "succeeded" && data.status !== "failed") {
      await new Promise(r => setTimeout(r, 1500));
      tentativas++;

      if (tentativas > 30) {
        return res.status(500).json({ erro: "Tempo excedido" });
      }

      const check = await fetch(data.urls.get, {
        headers: {
          "Authorization": `Token ${token}`
        }
      });

      data = await check.json();
    }

    // 🎯 pega imagem
    const imagem = Array.isArray(data.output)
      ? data.output[0]
      : data.output;

    if (!imagem) {
      console.error("Resposta sem imagem:", data);
      return res.status(500).json({ erro: "IA não retornou imagem" });
    }

    return res.status(200).json({ imagem });

  } catch (err) {
    console.error("Erro:", err);
    return res.status(500).json({ erro: "Erro interno" });
  }
}
