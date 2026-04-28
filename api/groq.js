const usoPorUsuario = {};

function hoje() {
  return new Date().toISOString().split("T")[0];
}

function verificarLimite(userId) {
  if (!usoPorUsuario[userId]) {
    usoPorUsuario[userId] = {
      data: hoje(),
      mensagens: 0
    };
  }

  const user = usoPorUsuario[userId];

  // reseta no dia seguinte
  if (user.data !== hoje()) {
    user.data = hoje();
    user.mensagens = 0;
  }

  // limite diário: 10 perguntas por dia
  if (user.mensagens >= 10) {
    return false;
  }

  user.mensagens++;
  return true;
}

export default async function handler(req, res) {
  try {
    const { userId, mensagem } = req.body;

    const usuario = userId || "anonimo";

    // verifica limite diário
    if (!verificarLimite(usuario)) {
      return res.status(429).json({
        reply: "⏰ Artista, você atingiu o limite de 10 perguntas hoje. Volte amanhã! 🎨"
      });
    }

    // respostas simples locais (sem API, sem custo)
    const texto = (mensagem || "").toLowerCase();

    let resposta = "Adoro arte! 🎨 Me conte mais sobre o que você quer saber!";

    if (
      texto.includes("oi") ||
      texto.includes("olá") ||
      texto.includes("ola") ||
      texto.includes("bom dia") ||
      texto.includes("boa tarde") ||
      texto.includes("boa noite")
    ) {
      resposta = "Oi! Eu sou o Candinho 🎨 Seu amigo artista! Vamos conversar sobre arte?";
    }

    else if (texto.includes("van gogh")) {
      resposta = "Van Gogh foi um pintor incrível! 🌻 Ele adorava cores fortes e pintou a famosa Noite Estrelada.";
    }

    else if (texto.includes("monalisa")) {
      resposta = "A Mona Lisa é uma pintura famosa de Leonardo da Vinci 😊 O sorriso dela virou um grande mistério!";
    }

    else if (texto.includes("tarsila")) {
      resposta = "Tarsila do Amaral foi uma grande artista brasileira 🇧🇷 Ela criou a famosa obra Abaporu!";
    }

    else if (texto.includes("picasso")) {
      resposta = "Picasso adorava criar de formas diferentes 🎨 Seus rostos e figuras pareciam quebra-cabeças!";
    }

    else if (texto.includes("frida")) {
      resposta = "Frida Kahlo foi uma artista mexicana cheia de personalidade 🌺 Suas pinturas contavam sua própria história.";
    }

    else if (texto.includes("desenho")) {
      resposta = "Desenhar é como dar vida à imaginação ✏️ Qual desenho você gosta de fazer?";
    }

    return res.status(200).json({
      reply: resposta
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      reply: "😅 Ops! Me embolei com meus pincéis. Tente novamente!"
    });
  }
}
