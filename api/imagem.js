export default async function handler(req, res) {
  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ erro: "Sem prompt" });

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return res.status(500).json({ erro: "Token do Replicate não configurado" });
  }

  try {
    // 1) Criar a previsão (endpoint com modelo liberado)
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
            prompt: `${prompt}, children's coloring book, black and white outline drawing, thick bold lines, no shading, white background`,
            width: 1024,
            height: 1024
          }
        })
      }
    );

    if (!create.ok) {
      const errTxt = await create.text();
      console.error("Replicate create error:", errTxt);
      return res.status(500).json({ erro: errTxt });
    }

    let data = await create.json();

    if (!data?.urls?.get) {
      console.error("Resposta inesperada do Replicate:", data);
      return res.status(500).json({ erro: "Resposta inválida da IA" });
    }

    // 2) Polling com limite (evita loop infinito)
    let tentativas = 0;
    const maxTentativas = 40;

    while (data.status !== "succeeded" && data.status !== "failed") {
      if (tentativas++ > maxTentativas) {
        return res.status(500).json({ erro: "Tempo excedido ao gerar imagem" });
      }

      await new Promise(r => setTimeout(r, 1500));

      const check = await fetch(data.urls.get, {
        headers: { "Authorization": `Token ${token}` }
      });

      if (!check.ok) {
        const errTxt = await check.text();
        console.error("Replicate check error:", errTxt);
        return res.status(500).json({ erro: errTxt });
      }

      data = await check.json();
    }

    // 3) Resultado
    if (data.status === "succeeded") {
      const imagem = Array.isArray(data.output) ? data.output[0] : data.output;
      if (!imagem) {
        console.error("Sem imagem no output:", data);
        return res.status(500).json({ erro: "IA não retornou imagem" });
      }
      return res.status(200).json({ imagem });
    } else {
      console.error("Falhou:", data);
      return res.status(500).json({ erro: "Falha ao gerar imagem" });
    }

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ erro: "Erro no servidor" });
  }
}
