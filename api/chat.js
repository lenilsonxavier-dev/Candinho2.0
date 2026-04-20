// api/chat.js – Gerador com fallback: Cloudflare → Pollinations
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

  // Prompt otimizado para desenho de colorir
  const prompt = `Create a high-quality, print-ready coloring book page. black and white, line art. The subject is: ${message}. Style: kid-friendly, bold and clear outlines, pure white background, no shading, no grayscale.`;

  // 1. Tenta Cloudflare Workers AI
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (accountId && apiToken) {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: prompt,
            steps: 8,
            width: 1024,
            height: 1024,
          }),
        }
      );

      const data = await response.json();
      const imageBase64 = data.result?.image;

      if (imageBase64) {
        return res.status(200).json({ imagem: `data:image/png;base64,${imageBase64}` });
      }

      // Se o erro for de limite (código 4006 ou mensagem "used up your daily free allocation")
      if (data.errors && data.errors.some(e => e.message && e.message.includes('used up your daily free allocation'))) {
        console.warn('⚠️ Limite Cloudflare excedido, usando Pollinations como fallback');
        // Vai para o fallback abaixo
      } else {
        console.error('Erro Cloudflare:', data);
        // Não falha ainda, tenta fallback
      }
    } catch (err) {
      console.error('Erro na requisição Cloudflare:', err);
      // Continua para fallback
    }
  }

  // 2. Fallback: Pollinations.ai (gratuito, sem chave)
  try {
    const promptEncoded = encodeURIComponent(prompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${promptEncoded}?width=1024&height=1024&nologo=true&_t=${Date.now()}`;
    
    // Opcional: verificar se a imagem é acessível (pré-carregamento)
    // Por enquanto, retorna a URL diretamente – o frontend tenta carregar.
    return res.status(200).json({ imagem: imageUrl });
  } catch (err) {
    console.error('Erro no fallback Pollinations:', err);
    return res.status(500).json({ error: 'Não foi possível gerar o desenho. Tente novamente mais tarde.' });
  }
}
