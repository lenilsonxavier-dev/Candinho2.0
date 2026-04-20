// api/chat.js – Gerador de desenhos (Cloudflare)
export default async function handler(req, res) {
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

  const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
  const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    console.error('Variáveis Cloudflare não configuradas');
    return res.status(500).json({ error: "Chaves Cloudflare não configuradas." });
  }

  const promptColorir = `Create a high-quality, print-ready coloring book page. black and white, line art. The subject is: ${message}. Style: kid-friendly, bold and clear outlines, large empty spaces for coloring, pure white background, no shading, no grayscale, no pre-existing colors. High contrast, perfect for printing.`;

  try {
    const response = await fetch(
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

    const data = await response.json();
    const imageBase64 = data.result?.image;

    if (imageBase64) {
      return res.status(200).json({
        imagem: `data:image/png;base64,${imageBase64}`,
      });
    } else {
      console.error('Resposta inesperada da Cloudflare:', data);
      throw new Error('Falha na geração');
    }
  } catch (err) {
    console.error('Erro:', err);
    return res.status(500).json({ error: "Erro ao gerar o desenho. Tente outra descrição." });
  }
}
