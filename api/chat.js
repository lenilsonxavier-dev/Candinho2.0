export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 1. Garantir que o body seja lido corretamente
  const { message, gerarImagem } = req.body || {};
  
  // Debug (veja isso no terminal do Vercel/Servidor)
  console.log("Recebido:", { message, gerarImagem });

  if (!message) {
    return res.status(400).json({ resposta: "Preciso de uma mensagem para continuar! 🎨" });
  }

  // 2. Normalizar a flag de imagem (aceita booleano ou string "true")
  const deveGerarImagem = gerarImagem === true || gerarImagem === 'true';

  // LÓGICA DE IMAGEM
  if (deveGerarImagem) {
    try {
      const prompt = encodeURIComponent(`Ilustração artística: ${message}. Estilo digital, alegre e criativo.`);
      const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 10000)}`;

      return res.status(200).json({
        resposta: `🎨 Aqui está o desenho que você pediu! Sou o Candinho, seu amigo artista! ✨`,
        imagem: imageUrl
      });
    } catch (err) {
      console.error('Erro na geração da imagem:', err);
    }
  }

  // LÓGICA DE TEXTO (Groq)
  try {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) throw new Error("Chave API ausente");

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: 'Você é o Candinho, especialista em arte. Responda de forma criativa e amigável. Sempre termine com "Candinho, seu amigo artista".' },
          { role: 'user', content: message }
        ],
        temperature: 0.7
      })
    });

    const data = await response.json();
    return res.status(200).json({
      resposta: data.choices?.[0]?.message?.content || 'Não consegui responder agora!',
      imagem: null
    });

  } catch (error) {
    console.error('Erro no Groq:', error);
    return res.status(500).json({ resposta: "😅 Tive um probleminha técnico. Tente novamente!" });
  }
}
