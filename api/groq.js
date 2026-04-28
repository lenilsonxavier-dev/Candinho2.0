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

  // limite diário: 5 perguntas por dia
  if (user.mensagens >= 5) {
    return false;
  }

  user.mensagens++;
  return true;
}

export default async function handler(req, res) {
  try {
    const { messages, model, userId } = req.body;

    // usa userId ou anonimo
    const usuario = userId || "anonimo";

    // verifica limite antes de chamar a IA
    if (!verificarLimite(usuario)) {
      return res.status(429).json({
        error: "⏰ Artista, você atingiu o limite de 5 perguntas hoje. Volte amanhã!"
      });
    }

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: model || "llama-3.1-8b-instant",
          messages,
          temperature: 0.7
          max_tokens: 80
        })
      }
    );

    const data = await response.json();

    res.status(200).json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Erro na API"
    });
  }
}
