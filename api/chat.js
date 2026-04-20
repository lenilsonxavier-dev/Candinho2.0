// api/chat.js – Gerador de desenhos para colorir (universo infantil)
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

  // ---------------------- IMAGEM (desenho para colorir) --------------------------
  if (gerarImagem) {
    const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
    const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
      console.error('Chaves Cloudflare não configuradas');
      return res.status(500).json({
        resposta: "🔑 Configure as variáveis CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN na Vercel.",
        imagem: null
      });
    }

    try {
      // 1. Detectar categoria para enriquecer o prompt
      const lowerMsg = message.toLowerCase();
      let detalhe = "";

      if (lowerMsg.includes("obra") || lowerMsg.includes("artista") || lowerMsg.includes("tarsila") || lowerMsg.includes("van gogh") || lowerMsg.includes("monet") || lowerMsg.includes("picasso") || lowerMsg.includes("da vinci") || lowerMsg.includes("frida") || lowerMsg.includes("dali")) {
        if (lowerMsg.includes("tarsila")) detalhe = " Estilo Tarsila do Amaral, Abaporu, formas brasileiras, em preto e branco para colorir.";
        else if (lowerMsg.includes("van gogh")) detalhe = " Estilo Van Gogh, Noite Estrelada, girassóis, traços fortes e ondulados.";
        else if (lowerMsg.includes("monet")) detalhe = " Estilo Monet, nenúfares, jardim, impressão suave em linha.";
        else if (lowerMsg.includes("picasso")) detalhe = " Estilo Picasso, cubismo, rostos geométricos.";
        else if (lowerMsg.includes("da vinci")) detalhe = " Estilo Da Vinci, Mona Lisa, proporções clássicas.";
        else if (lowerMsg.includes("frida")) detalhe = " Estilo Frida Kahlo, autorretrato, flores, natureza.";
        else if (lowerMsg.includes("dali")) detalhe = " Estilo Salvador Dalí, relógios derretidos, surrealismo.";
        else detalhe = " Releitura de obra-prima da história da arte, em estilo de desenho para colorir educativo.";
      }
      else if (lowerMsg.includes("mapa") || lowerMsg.includes("geografia") || lowerMsg.includes("país") || lowerMsg.includes("brasil") || lowerMsg.includes("mundo")) {
        detalhe = " Desenho de mapa com contornos nítidos, fronteiras, rios, cidades principais, em estilo de página para colorir educativa.";
      }
      else if (lowerMsg.includes("animal") || lowerMsg.includes("inseto") || lowerMsg.includes("pássaro") || lowerMsg.includes("peixe") || lowerMsg.includes("borboleta") || lowerMsg.includes("abelha") || lowerMsg.includes("joaninha")) {
        detalhe = " Desenho realista mas com linhas grossas, adequado para colorir, mostrando detalhes naturais do animal/inseto.";
      }
      else if (lowerMsg.includes("cidade") || lowerMsg.includes("prédio") || lowerMsg.includes("monumento") || lowerMsg.includes("paris") || lowerMsg.includes("nova york") || lowerMsg.includes("rio de janeiro")) {
        detalhe = " Desenho de cidade com pontos turísticos, prédios, ruas, em estilo de desenho para colorir, muitos detalhes arquitetônicos.";
      }
      else if (lowerMsg.includes("personagem") || lowerMsg.includes("herói") || lowerMsg.includes("super") || lowerMsg.includes("vilão") || lowerMsg.includes("princesa") || lowerMsg.includes("fada") || lowerMsg.includes("bruxa")) {
        detalhe = " Personagem infantil de desenho animado ou história em quadrinhos, estilo cartoon, expressivo, linhas grossas, fácil de colorir.";
      }
      else if (lowerMsg.includes("game") || lowerMsg.includes("anime") || lowerMsg.includes("mario") || lowerMsg.includes("sonic") || lowerMsg.includes("pokemon") || lowerMsg.includes("naruto") || lowerMsg.includes("dragon ball")) {
        detalhe = " Personagem famoso de videogame ou anime, estilo fiel ao original mas em preto e branco para colorir, traços marcantes.";
      }
      else if (lowerMsg.includes("conto") || lowerMsg.includes("fada") || lowerMsg.includes("bruxa") || lowerMsg.includes("príncipe") || lowerMsg.includes("princesa") || lowerMsg.includes("castelo") || lowerMsg.includes("dragão") || lowerMsg.includes("unicórnio")) {
        detalhe = " Cena de conto de fadas clássico (Cinderela, Branca de Neve, João e Maria, etc.), estilo mágico, muitos elementos para colorir.";
      }
      else {
        detalhe = " Tema lúdico, educativo, com traços simples e divertidos, adequado para crianças.";
      }

      // 2. Prompt otimizado para desenho de colorir
      const promptColorir = `Desenho para colorir, página de colorir infantil, linha preta e branca, contornos grossos e bem definidos, sem sombreamento, sem tons de cinza, fundo branco puro, estilo simples e educativo. Assunto: ${message}. ${detalhe} Certifique-se de que o desenho seja adequado para crianças, com áreas amplas para colorir e detalhes nítidos. Não adicione cores, apenas contornos pretos sobre fundo branco.`;

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
          }),
        }
      );

      const data = await response.json();
      const imageBase64 = data.result?.image;

      if (imageBase64) {
        const imageUrl = `data:image/png;base64,${imageBase64}`;
        return res.status(200).json({
          resposta: `🖍️ Aqui está o desenho para colorir que você pediu! Imprima e use lápis de cor, giz de cera ou canetinha. Divirta-se colorindo! Sou o Candinho, seu amigo artista. ✨`,
          imagem: imageUrl
        });
      } else {
        console.error('Erro na resposta da Cloudflare:', data);
        throw new Error('Falha na geração do desenho');
      }
    } catch (err) {
      console.error('Erro Cloudflare:', err);
      return res.status(500).json({
        resposta: "😅 Não consegui gerar o desenho para colorir agora. Tente outra descrição (ex: 'desenho para colorir de um gato').",
        imagem: null
      });
    }
  }

  // ---------------------- TEXTO (conhecimento sobre arte) --------------------------
  const lowerMsg = message.toLowerCase();
  let resposta = "";

  if (lowerMsg.includes("van gogh")) {
    resposta = "🎨 Van Gogh foi um pintor pós-impressionista holandês. Suas obras mais famosas são 'Noite Estrelada' e 'Girassóis'. Ele usava pinc
