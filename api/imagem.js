// api/imagem.js
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt é obrigatório' });

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Token do Replicate não configurado' });
  }

  try {
    // 1) Criar a previsão
    const createResp = await fetch(
      "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions",
      {
        method: "POST",
        headers: {
          "Authorization": `Token ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          input: {
            prompt: prompt,
            width: 1024,
            height: 1024,
            num_outputs: 1
          }
        })
      }
    );

    if (!createResp.ok) {
      const errText = await createResp.text();
      console.error("Replicate create error:", errText);
      return res.status(500).json({ error: "Falha ao iniciar geração" });
    }

    let prediction = await createResp.json();
    const getUrl = prediction.urls?.get;
    if (!getUrl) {
      console.error("Resposta inesperada:", prediction);
      return res.status(500).json({ error: "Resposta inválida da IA" });
    }

    // 2) Polling (aguardar conclusão)
    let tentativas = 0;
    const maxTentativas = 30;
    while (prediction.status !== "succeeded" && prediction.status !== "failed") {
      if (tentativas++ > maxTentativas) {
        return res.status(500).json({ error: "Tempo excedido" });
      }
      await new Promise(r => setTimeout(r, 1500));
      const checkResp = await fetch(getUrl, {
        headers: { "Authorization": `Token ${token}` }
      });
      if (!checkResp.ok) {
        const errText = await checkResp.text();
        console.error("Polling error:", errText);
        return res.status(500).json({ error: "Erro ao verificar status" });
      }
      prediction = await checkResp.json();
    }

    if (prediction.status === "succeeded") {
      const output = prediction.output;
      const imagem = Array.isArray(output) ? output[0] : output;
      if (!imagem) {
        console.error("Sem imagem no output:", prediction);
        return res.status(500).json({ error: "IA não retornou imagem" });
      }
      return res.status(200).json({ imagem });
    } else {
      console.error("Falha na geração:", prediction);
      return res.status(500).json({ error: "Falha ao gerar imagem" });
    }
  } catch (err) {
    console.error("Erro no servidor:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
}
