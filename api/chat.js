// api/chat.js – usando Cloudflare Workers AI (gratuito e estável)
export default async function handler(req, res) {
  // CORS
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

  // ---------------------- IMAGEM (Cloudflare) --------------------------
  if (gerarImagem) {
    const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
    const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
      return res.status(500).json({
        resposta: "🔑 Chaves da Cloudflare não configuradas. Adicione as variáveis de ambiente na Vercel.",
        imagem: null
      });
    }

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
            prompt: message,
          }),
        }
      );

      const data = await response.json();
      const imageBase64 = data.result?.image;

      if (imageBase64) {
        const imageUrl = `data:image/png;base64,${imageBase64}`;
        return res.status(200).json({
          resposta: `🎨 Aqui está o desenho que você pediu! Sou o Candinho, seu amigo artista! ✨`,
          imagem: imageUrl
        });
      } else {
        throw new Error('Falha na geração da imagem: ' + JSON.stringify(data));
      }
    } catch (err) {
      console.error('Erro Cloudflare:', err);
      return res.status(500).json({
        resposta: "😅 Não consegui gerar o desenho agora. Tente outra descrição.",
        imagem: null
      });
    }
  }

  // ---------------------- TEXTO (respostas locais) --------------------------
  const lowerMsg = message.toLowerCase();
  let resposta = "";

  if (lowerMsg.includes("van gogh")) {
    resposta = "🎨 Van Gogh foi um pintor pós-impressionista holandês. Suas obras mais famosas são 'Noite Estrelada' e 'Girassóis'. Ele usava pinceladas grossas e cores vibrantes. Infelizmente, só vendeu um quadro em vida, mas hoje é um dos artistas mais amados do mundo! ✨";
  } 
  else if (lowerMsg.includes("tarsila") || lowerMsg.includes("tarsila do amaral")) {
    resposta = "🇧🇷 Tarsila do Amaral foi uma das maiores artistas do modernismo brasileiro! Criou o movimento 'Antropofágico' e pintou obras icônicas como 'Abaporu' e 'Operários'. Ela queria criar uma arte genuinamente brasileira. 🎨🌴";
  }
  else if (lowerMsg.includes("monet") || lowerMsg.includes("claude monet")) {
    resposta = "🪷 Claude Monet foi o pai do Impressionismo! Ele pintava a mesma cena em diferentes horas do dia para capturar a luz. Famoso por seus 'Nenúfares' e a série da Catedral de Rouen. 🌅";
  }
  else if (lowerMsg.includes("dali") || lowerMsg.includes("salvador dali")) {
    resposta = "⏰ Salvador Dalí foi um surrealista espanhol! Seus quadros parecem sonhos estranhos, como 'A Persistência da Memória' (aqueles relógios derretidos). Ele também fazia filmes e esculturas. 🐘";
  }
  else if (lowerMsg.includes("frida") || lowerMsg.includes("frida kahlo")) {
    resposta = "🌺 Frida Kahlo foi uma artista mexicana conhecida por seus autorretratos cheios de simbolismo. Ela pintava sua dor e sua identidade. 'As Duas Fridas' e 'A Coluna Quebrada' são obras emocionantes. 💔🎨";
  }
  else if (lowerMsg.includes("picasso") || lowerMsg.includes("pablo picasso")) {
    resposta = "🎭 Pablo Picasso foi um gênio espanhol, cofundador do Cubismo! Ele pintava pessoas com rostos vistos de vários ângulos ao mesmo tempo. Obra famosa: 'Guernica', que retrata os horrores da guerra. 🔲";
  }
  else if (lowerMsg.includes("leonardo") || lowerMsg.includes("da vinci")) {
    resposta = "🖌️ Leonardo da Vinci foi o maior polímata do Renascimento! Pintou 'Mona Lisa' e 'A Última Ceia', mas também era inventor, cientista e anatomista. ✨";
  }
  else if (lowerMsg.includes("arte") && (lowerMsg.includes("o que é") || lowerMsg.includes("definição"))) {
    resposta = "🎨 Arte é a expressão da criatividade humana! Pode ser pintura, escultura, música, dança, teatro… O Candinho acredita que arte é tudo que toca o coração e faz a gente sentir algo especial. ❤️";
  }
  else {
    resposta = `Que legal você perguntar sobre arte! 🎨 Sou o Candinho, seu amigo artista. Sobre "${message}", posso dizer que a arte está em tudo ao nosso redor. Se quiser, peça um desenho (ex: "desenhe um gato") ou pergunte sobre um artista específico (Van Gogh, Tarsila, Monet, Frida...). ✨`;
  }

  return res.status(200).json({
    resposta: resposta + " – Candinho, seu amigo artista! 🖌️",
    imagem: null
  });
}
