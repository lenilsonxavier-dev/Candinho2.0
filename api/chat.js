export default async function handler(req, res) {
  // Habilitar CORS para desenvolvimento
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, gerarImagem } = req.body;
  const GORQ_API_KEY = process.env.GORQ_API_KEY;

  if (!GORQ_API_KEY) {
    console.error('GORQ_API_KEY não configurada');
    return res.status(500).json({ 
      resposta: "Configure a chave da API GORQ nas variáveis de ambiente da Vercel! 🔑",
      imagem: null
    });
  }

  try {
    if (gerarImagem) {
      // Gerar imagem usando GORQ
      const prompt = `Crie uma ilustração artística de: ${message}. Estilo: arte digital colorida, detalhada, bonita e criativa.`;
      
      const imageResponse = await fetch('https://api.gorq.ai/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GORQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "flux-schnell",
          prompt: prompt,
          n: 1,
          size: "1024x1024"
        })
      });

      if (!imageResponse.ok) {
        const errorText = await imageResponse.text();
        console.error('Erro GORQ Imagem:', errorText);
        throw new Error(`Falha na geração: ${imageResponse.status}`);
      }

      const imageData = await imageResponse.json();
      const imageUrl = imageData.data?.[0]?.url;

      // Resposta com a imagem
      return res.status(200).json({
        resposta: `🎨 Aqui está o desenho que você pediu! Espero que goste da minha arte!`,
        imagem: imageUrl
      });

    } else {
      // Responder apenas texto (perguntas sobre arte)
      const chatResponse = await fetch('https://api.gorq.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GORQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "llama3-8b-8192",
          messages: [
            {
              role: "system",
              content: "Você é o Candinho, um especialista em arte brasileiro e mundial. Você ama arte, pintura, desenhos e artistas. Responda de forma educada, criativa e com entusiasmo sobre arte. Use emojis de arte 🎨✨🖌️. Seja amigável e encorajador."
            },
            {
              role: "user",
              content: message
            }
          ],
          temperature: 0.7,
          max_tokens: 500
        })
      });

      if (!chatResponse.ok) {
        throw new Error(`Erro na API de chat: ${chatResponse.status}`);
      }

      const chatData = await chatResponse.json();
      const respostaTexto = chatData.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua pergunta sobre arte!";

      return res.status(200).json({
        resposta: respostaTexto,
        imagem: null
      });
    }

  } catch (error) {
    console.error('Erro no handler:', error);
    return res.status(500).json({
      resposta: "😅 Tive um probleminha técnico! Tente novamente em alguns segundos. 🎨",
      imagem: null
    });
  }
}
