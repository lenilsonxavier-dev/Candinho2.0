export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  const { prompt } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ erro: "Sem prompt" });
  }

  const token = process.env.REPLICATE_API_TOKEN;

  if (!token) {
    return res.status(500).json({ erro: "Token não configurado no Vercel" });
  }

  try {
    // 🎨 1. Criar imagem
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
      const erro = await create.text();
      console.error("Erro ao criar:", erro);
      return res.status(500).json({ erro });
    }

    let data = await create.json();

    if (!data?.urls?.get) {
      return res.status(500).json({ erro: "Resposta inválida da IA" });
    }

    // ⏳ 2. Esperar resultado
    let tentativas = 0;
    const max = 30;

    while (data.status !== "succeeded" && data.status !== "failed") {
      if (tentativas++ > max) {
        return res.status(500).json({ erro: "Tempo excedido" });
      }

      await new Promise(r => setTimeout(r, 1500));

      const check = await fetch(data.urls.get, {
        headers: {
          "Authorization": `Token ${token}`
        }
      });

      if (!check.ok) {
        const erro = await check.text();
        console.error("Erro ao consultar:", erro);
        return res.status(500).json({ erro });
      }

      data = await check.json();
    }

    // 🎯 3. Retornar imagem
    if (data.status === "succeeded") {
      const imagem = Array.isArray(data.output)
        ? data.output[0]
        : data.output;

      return res.status(200).json({ imagem });
    }

    return res.status(500).json({ erro: "Falha na geração" });

  } catch (err) {
    console.error("Erro geral:", err);
    return res.status(500).json({ erro: "Erro interno" });
  }
}
