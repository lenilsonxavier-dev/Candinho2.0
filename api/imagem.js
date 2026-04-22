// api/imagem.js – Com fallback automático para Pollinations
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt é obrigatório' });

  const token = process.env.REPLICATE_API_TOKEN;

  // 1) Tenta Replicate (se tiver token)
  if (token) {
    try {
      const createResp = await fetch(
        "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions",
        {
          method: "POST",
          headers: {
            "Authorization": `Token ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            input: { prompt, width: 1024, height: 1024, num_outputs: 1 }
          })
        }
      );

      if (createResp.ok) {
        let prediction = await createResp.json();
        const getUrl = prediction.urls?.get;

        if (getUrl) {
          let tentativas = 0;
          while (prediction.status !== "succeeded" && prediction.status !== "failed") {
            if (tentativas++ > 30) break;
            await new Promise(r => setTimeout(r, 1500));
            const checkResp = await fetch(getUrl, {
              headers: { "Authorization": `Token ${token}` }
            });
            if (!checkResp.ok) break;
            prediction = await checkResp.json();
          }
          if (prediction.status === "succeeded") {
            const output = prediction.output;
            const imagem = Array.isArray(output) ? output[0] : output;
            if (imagem) return res.status(200).json({ imagem });
          }
        }
      }
      // Se chegou aqui, Replicate falhou (crédito insuficiente ou outro erro)
      console.log("Replicate falhou, usando Pollinations fallback");
    } catch (err) {
      console.error("Erro no Replicate:", err.message);
    }
  }

  // 2) Fallback: Pollinations.ai (gratuito)
  try {
    const promptEncoded = encodeURIComponent(`${prompt}, coloring page for kids, black and white line art, thick bold outlines, white background`);
    const imageUrl = `https://image.pollinations.ai/prompt/${promptEncoded}?width=1024&height=1024&nologo=true&model=flux&_t=${Date.now()}`;
    return res.status(200).json({ imagem: imageUrl });
  } catch (err) {
    console.error("Pollinations falhou:", err);
    return res.status(500).json({ error: "Nenhum serviço disponível. Tente novamente." });
  }
}
