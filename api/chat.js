export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 1. Log para verificar o que está chegando
  console.log('Corpo da requisição recebido:', req.body);

  // 2. Proteção: Verifica se req.body existe
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Corpo da requisição inválido. Certifique-se de enviar JSON.' });
  }

  const { message, gerarImagem } = req.body;

  // ---------------------- IMAGEM --------------------------
  if (gerarImagem) {
    try {
      const prompt = encodeURIComponent(
        `Ilustração artística colorida e detalhada de: ${message || "arte abstrata"}. Estilo digital bonito, criativo, alegre.`
      );
      const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?width=1024&height=1024&nologo=true&_t=${Date.now()}`;
      
      return res.status(200).json({
        resposta: `🎨 Aqui está o desenho que você pediu! Sou o Candinho, seu amigo artista! ✨`,
        imagem: imageUrl
      });
    } catch (err) {
      console.error('Erro na API de imagem:', err);
      return res.status(500).json({ resposta: "😅 Não consegui gerar o desenho agora.", imagem: null });
    }
  }

  // ---------------------- TEXTO --------------------------
  const lowerMsg = (message || "").toLowerCase();
  let resposta = "";

  // ... (sua lógica de ifs anterior continua aqui) ...
  if (lowerMsg.includes("van gogh")) {
    resposta = "🎨 Van Gogh foi um pintor pós-impressionista holandês. ✨";
  } else {
    resposta = "Olá! Sobre " + (message || "isso") + ", a arte está em tudo! ✨";
  }

  return res.status(200).json({
    resposta: resposta + " – Candinho, seu amigo artista! 🖌️",
    imagem: null
  });
}
