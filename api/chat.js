// api/chat.js
export default async function handler(req, res) {
  // Configuração de CORS para permitir requisições do seu frontend
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, gerarImagem } = req.body;
  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  // 1. SE FOR PEDIDO DE IMAGEM
  if (gerarImagem) {
    try {
      const prompt = encodeURIComponent(
        `Ilustração artística colorida e detalhada de: ${message}. Estilo digital bonito, criativo, alegre.`
      );

      // Tenta gerar a imagem com Pollinations
      let imageUrl = `https://image.pollinations.ai/prompt/${prompt}?width=1024&height=1024&nologo=true`;
      
      // Adiciona timestamp para evitar cache de imagens quebradas
      const finalImageUrl = `${imageUrl}&_t=${Date.now()}`;

      // Retorna a URL da imagem gerada
      return res.status(200).json({
        resposta: `🎨 Aqui está o desenho que você pediu! Sou o Candinho, seu amigo artista! ✨`,
        imagem: finalImageUrl
      });
    } catch (err) {
      console.error('Erro ao gerar URL da imagem:', err);
      return res.status(500).json({
        resposta: "😅 Não consegui gerar o desenho agora. Tente outra descrição.",
        imagem: null
      });
    }
  }

  // 2. SE FOR PERGUNTA SOBRE ARTE (TEXTO)
  // ... (mantenha a mesma lógica do seu código atual para respostas de texto)
  // Lembre-se de usar a GROQ_API_KEY se disponível, ou o banco de conhecimento local.
  // [Cole aqui a sua lógica de respostas de texto do código anterior]
  // Se não tiver a chave, use o banco de conhecimento local.
  
  const lowerMsg = message.toLowerCase();
  let resposta = "";

  // Banco de conhecimento do Candinho
  if (lowerMsg.includes("van gogh")) {
    resposta = "🎨 Van Gogh foi um pintor pós-impressionista holandês. Suas obras mais famosas são 'Noite Estrelada' e 'Girassóis'. Ele usava pinceladas grossas e cores vibrantes. Infelizmente, só vendeu um quadro em vida, mas hoje é um dos artistas mais amados do mundo! ✨";
  } 
  else if (lowerMsg.includes("tarsila") || lowerMsg.includes("tarsila do amaral")) {
    resposta = "🇧🇷 Tarsila do Amaral foi uma das maiores artistas do modernismo brasileiro! Criou o movimento 'Antropofágico' e pintou obras icônicas como 'Abaporu' e 'Operários'. Ela queria criar uma arte genuinamente brasileira. 🎨🌴";
  }
  else {
    // Resposta genérica educada
    resposta = `Que legal você perguntar sobre arte! 🎨 Eu sou o Candinho, seu amigo artista. Sobre "${message}", posso dizer que a arte está em tudo ao nosso redor. Se você quiser, peça um desenho (ex: "desenhe um gato") ou pergunte sobre um artista específico (Van Gogh, Tarsila, Monet, etc.). ✨`;
  }

  return res.status(200).json({
    resposta: resposta + " – Candinho, seu amigo artista! 🖌️",
    imagem: null
  });
}
