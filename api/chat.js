export default async function handler(req, res) {
  // CORS
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
  const GROQ_API_KEY = process.env.GROQ_API_KEY;  // ← variável correta

  // Se for pedido de imagem, usamos Pollinations (grátis, sem chave)
  if (gerarImagem) {
    try {
      // Prompt melhorado para arte
      const prompt = encodeURIComponent(
        `Ilustração artística colorida e detalhada de: ${message}. Estilo digital bonito, criativo, alegre.`
      );
      // Pollinations gera imagem diretamente via URL
      const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?width=1024&height=1024&nologo=true`;

      return res.status(200).json({
        resposta: `🎨 Aqui está o desenho que você pediu! Sou o Candinho, seu amigo artista! ✨`,
        imagem: imageUrl
      });
    } catch (err) {
      console.error('Erro na geração da imagem:', err);
      return res.status(500).json({
        resposta: "😅 Não consegui criar o desenho agora. Tente de novo em alguns segundos!",
        imagem: null
      });
    }
  }

  // Se for só pergunta sobre arte (texto) – usamos a Groq
  if (!GROQ_API_KEY) {
    return res.status(500).json({
      resposta: "🔑 Configure a variável GROQ_API_KEY na Vercel (Environment Variables).",
      imagem: null
    });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          {
            role: 'system',
            content: 'Você é o Candinho, um especialista em arte brasileiro e mundial. Você ama arte, pintura, desenhos e artistas. Responda de forma educada, criativa e com entusiasmo sobre arte. Use emojis de arte 🎨✨🖌️. Seja amigável e encorajador. Sempre termine se identificando como "Candinho, seu amigo artista".'
          },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const erro = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${erro}`);
    }

    const data = await response.json();
    const respostaTexto = data.choices?.[0]?.message?.content || 'Não consegui responder agora, mas estou aqui para arte! 🎨';

    return res.status(200).json({
      resposta: respostaTexto,
      imagem: null
    });
  } catch (error) {
    console.error('Erro no chat:', error);
    return res.status(500).json({
      resposta: "😅 Tive um probleminha técnico! Tente novamente em alguns segundos. 🎨",
      imagem: null
    });
  }
}
