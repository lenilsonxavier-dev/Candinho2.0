// api/chat.js – Gera desenhos coloridos OU para colorir (preto e branco)
export default async function handler(req, res) {
  // CORS (mesmo de antes)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, gerarImagem } = req.body;

  // ---------------------- IMAGEM --------------------------
  if (gerarImagem) {
    const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
    const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
      console.error('Chaves da Cloudflare não configuradas');
      return res.status(500).json({
        resposta: "🔑 Configure as variáveis CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN na Vercel.",
        imagem: null
      });
    }

    try {
      // Verifica se o pedido é para colorir
      const isColoring = /colorir|para colorir|livro de colorir|pintar|coloring/i.test(message);
      
      let promptDesenho;
      if (isColoring) {
        // Desenho para colorir: linha preta, fundo branco, sem cores
        promptDesenho = `Desenho em linha preta, estilo livro de colorir para crianças, contornos grossos, fundo branco, sem preenchimento de cor, apenas contornos: ${message.replace(/colorir|para colorir|livro de colorir|pintar/gi, '').trim()}. Desenho simples e claro.`;
      } else {
        // Desenho colorido normal
        promptDesenho = `Desenho ilustrado, estilo cartoon, traços definidos, arte digital colorida, sem realismo, sem fotografia: ${message}.`;
      }
      
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: promptDesenho,
          }),
        }
      );

      const data = await response.json();
      const imageBase64 = data.result?.image;

      if (imageBase64) {
        const imageUrl = `data:image/png;base64,${imageBase64}`;
        let respostaTexto;
        if (isColoring) {
          respostaTexto = `🖍️ Aqui está o desenho para colorir que você pediu! Imprima e use sua criatividade! Sou o Candinho, seu amigo artista! ✨`;
        } else {
          respostaTexto = `🎨 Aqui está o desenho que você pediu! Sou o Candinho, seu amigo artista! ✨`;
        }
        return res.status(200).json({
          resposta: respostaTexto,
          imagem: imageUrl
        });
      } else {
        console.error('Erro na resposta da Cloudflare:', data);
        throw new Error('Falha na geração');
      }
    } catch (err) {
      console.error('Erro Cloudflare:', err);
      return res.status(500).json({
        resposta: "😅 Não consegui gerar o desenho agora. Tente outra descrição.",
        imagem: null
      });
    }
  }

  // ---------------------- TEXTO (mesmo de antes) --------------------------
  const lowerMsg = message.toLowerCase();
  let resposta = "";

  if (lowerMsg.includes("van gogh")) {
    resposta = "🎨 Van Gogh foi um pintor pós-impressionista holandês... (mantenha o texto original)";
  } 
  // ... (copie o restante do seu código de respostas de texto)
  else {
    resposta = `Que legal você perguntar sobre arte! 🎨 Sou o Candinho, seu amigo artista. Se quiser um desenho para colorir, peça "desenhe um gato para colorir". Para desenho colorido, diga apenas "desenhe um gato". ✨`;
  }

  return res.status(200).json({
    resposta: resposta + " – Candinho, seu amigo artista! 🖌️",
    imagem: null
  });
}
