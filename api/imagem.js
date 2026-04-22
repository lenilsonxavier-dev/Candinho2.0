// api/chat.js – Gerador de desenhos para colorir usando Replicate (flux-schnell)
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, gerarImagem } = req.body;
  if (!gerarImagem) {
    return res.status(400).json({ error: "Este endpoint só gera imagens." });
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "Token do Replicate não configurado. Adicione REPLICATE_API_TOKEN nas variáveis de ambiente da Vercel." });
  }

  // Prompt otimizado para desenho de colorir
  const prompt = `${message}, children's coloring book, black and white outline drawing, thick bold lines, no shading, white background, high contrast, perfect for printing`;

  try {
    // 1) Criar a previsão (prediction) no Replicate
    const createResponse = await fetch(
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

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("Erro ao criar prediction no Replicate:", errorText);
      return res.status(500).json({ error: "Falha ao iniciar geração na Replicate." });
    }

    let prediction = await createResponse.json();
    const getUrl = prediction.urls?.get;
    if (!getUrl) {
      console.error("Resposta inesperada do Replicate:", prediction);
      return res.status(500).json({ error: "Resposta inválida da IA." });
    }

    // 2) Polling (aguarda a conclusão)
    let tentativas = 0;
    const maxTentativas = 30; // ~45 segundos (30 * 1.5s)

    while (prediction.status !== "succeeded" && prediction.status !== "failed") {
      if (tentativas++ > maxTentativas) {
        return res.status(500).json({ error: "Tempo excedido ao gerar o desenho." });
      }
      await new Promise(resolve => setTimeout(resolve, 1500));
      const checkResponse = await fetch(getUrl, {
        headers: { "Authorization": `Token ${token}` }
      });
      if (!checkResponse.ok) {
        const errText = await checkResponse.text();
        console.error("Erro no polling:", errText);
        return res.status(500).json({ error: "Erro ao verificar status da geração." });
      }
      prediction = await checkResponse.json();
    }

    // 3) Verificar se obteve a imagem
    if (prediction.status === "succeeded") {
      const output = prediction.output;
      let imageUrl = null;
      if (Array.isArray(output) && output.length > 0) {
        imageUrl = output[0];
      } else if (typeof output === "string") {
        imageUrl = output;
      }
      if (!imageUrl) {
        console.error("Output sem imagem:", prediction);
        return res.status(500).json({ error: "IA não retornou uma imagem válida." });
      }
      return res.status(200).json({ imagem: imageUrl });
    } else {
      console.error("Falha na geração:", prediction);
      return res.status(500).json({ error: "Falha ao gerar o desenho." });
    }
  } catch (err) {
    console.error("Erro no servidor:", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
}
