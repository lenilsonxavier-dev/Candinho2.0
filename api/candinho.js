import dancas from "./data/dancas.json";
import artes from "./data/artes_visuais.json";
import artistas from "./data/artistas.json";
import historia from "./data/historia_arte.json";
import teatro from "./data/teatro.json";
import musica from "./data/musica.json";
import folclore from "./data/folclore.json";
import ritmos from "./data/ritmos_musicais.json";

import festas from "./data/festas_brasileiras.json";
import lugares from "./data/lugares_arte.json";
import curiosidades from "./data/curiosidades.json";
import indigena from "./data/cultura_indigena.json";
import afro from "./data/cultura_afro_brasileira.json";
import atividades from "./data/atividades_artisticas.json";
import emocional from "./data/apoio_emocional.json";
import piadas from "./data/piadas.json";

// 🔍 BUSCADOR
function buscarContexto(pergunta) {
  const texto = pergunta.toLowerCase();

  const bases = [
    dancas, artes, artistas, historia, teatro, musica,
    indigena, afro, folclore, ritmos, lugares, festas
  ];

  for (const base of bases) {
    for (const chave in base) {
      if (texto.includes(chave.replace(/_/g, " "))) {
        return base[chave].explicacao_infantil;
      }
    }
  }

  return "";
}


// 🧠 PROMPT
function montarPrompt(pergunta, contexto) {
  return `
Você é Candinho, um professor de arte de 60 anos, gentil e acolhedor.

- responda em português
- linguagem simples para crianças
- máximo 3 linhas
- educativo e criativo
- nunca invente conteúdo fora do contexto

Use estas informações:
${contexto}

Pergunta:
${pergunta}
`;
}


// 🚀 HANDLER (ESSENCIAL)
export default async function handler(req, res) {
  try {
    const { mensagem } = req.body;

    let contexto = buscarContexto(mensagem);

    if (!contexto) {
      contexto = "Explique de forma educativa e simples para uma criança.";
    }

    const respostaIA = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gemma:2b",
        prompt: montarPrompt(mensagem, contexto)
      })
    });

    const data = await respostaIA.json();

    res.status(200).json({
      reply: data.response
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      reply: "😅 Candinho se confundiu com os pincéis. Tente novamente!"
    });
  }
}
