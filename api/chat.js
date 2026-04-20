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

  try {
    // Prompt otimizado para desenho de colorir (preto e branco, linhas grossas, fundo branco)
    const promptColorir = `Desenho para colorir, página de colorir infantil, linha preta e branca, contornos grossos e bem definidos, sem sombreamento, sem tons de cinza, fundo branco puro, estilo simples e educativo. Assunto: ${message}. Certifique-se de que o desenho seja adequado para crianças, com áreas amplas para colorir e detalhes nítidos. Não adicione cores, apenas contornos pretos sobre fundo branco.`;

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: promptColorir }),
      }
    );

    const data = await response.json();
    const imageBase64 = data.result?.image;

    if (imageBase64) {
      return res.status(200).json({
        imagem: `data:image/png;base64,${imageBase64}`,
      });
    } else {
      throw new Error('Falha na geração do desenho');
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao gerar o desenho. Tente outra descrição." });
  }
}
