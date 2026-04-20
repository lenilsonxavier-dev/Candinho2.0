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
    return res.status(400).json({ error: "Este endpoint só gera imagens. Use 'gerarImagem: true'." });
  }

  const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
  const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    return res.status(500).json({ error: "Chaves Cloudflare não configuradas." });
  }

  // 1. Prompt otimizado para desenho de colorir (preto e branco, linhas grossas, alta qualidade)
  const promptColorir = `Create a high-quality, print-ready coloring book page. black and white, line art. The subject is: ${message}. Style: kid-friendly, bold and clear outlines, large empty spaces for coloring, pure white background, no shading, no grayscale, no pre-existing colors. High contrast, perfect for printing.`;

  // 2. Escolha o melhor modelo disponível: FLUX.2 [dev] (mais preciso) ou fallback para Schnell
  // Por enquanto usaremos o FLUX.2 [dev] que tem melhor aderência a temas específicos.
  const MODEL = "@cf/black-forest-labs/flux-2-dev"; // ou "@cf/black-forest-labs/flux-1-schnell" como fallback

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${MODEL}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: promptColorir,
          steps: 8,          // Aumenta qualidade (padrão era 4)
          width: 1024,
          height: 1024,
        }),
      }
    );

    const data = await response.json();
    const imageBase64 = data.result?.image;

    if (imageBase64) {
      return res.status(200).json({
        imagem: `data:image/png;base64,${imageBase64}`,
      });
    } else {
      // Se falhar com FLUX.2, tenta com Schnell como fallback
      console.warn("FLUX.2 falhou, tentando Schnell como fallback");
      const fallbackResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: promptColorir,
            steps: 8,
            width: 1024,
            height: 1024,
          }),
        }
      );
      const fallbackData = await fallbackResponse.json();
      const fallbackImage = fallbackData.result?.image;
      if (fallbackImage) {
        return res.status(200).json({ imagem: `data:image/png;base64,${fallbackImage}` });
      } else {
        throw new Error('Falha na geração com ambos os modelos');
      }
    }
  } catch (err) {
    console.error('Erro na geração:', err);
    return res.status(500).json({ error: "Erro ao gerar o desenho. Tente outra descrição." });
  }
}
