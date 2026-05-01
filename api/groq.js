// api/groq.js
// ======================= IMPORTAÇÃO DOS JSONs =======================
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

// ======================= FUNÇÃO AUXILIAR: PEGAR ALEATÓRIO =======================
function pegarAleatorio(obj) {
  if (!obj || typeof obj !== "object") return null;
  const valores = Object.values(obj);
  if (valores.length === 0) return null;
  const item = valores[Math.floor(Math.random() * valores.length)];
  // Se for objeto, tenta pegar explicacao_infantil, senão retorna o próprio valor
  if (typeof item === "object" && item.explicacao_infantil) return item.explicacao_infantil;
  return String(item);
}

// ======================= RESPOSTAS INSTANTÂNEAS (SEM IA) =======================
function respostaInstantanea(pergunta) {
  const texto = pergunta.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Piadas
  if (texto.includes("piada") || texto.includes("piadas")) return pegarAleatorio(piadas);
  // Curiosidades
  if (texto.includes("curiosidade") || texto.includes("curiosidades")) return pegarAleatorio(curiosidades);
  // Atividades artísticas
  if (texto.includes("atividade") || texto.includes("brincadeira") || texto.includes("fazer")) return pegarAleatorio(atividades);
  // Artistas
  if (texto.includes("artista") || texto.includes("artistas") || texto.includes("pintor")) return pegarAleatorio(artistas);
  // Dança
  if (texto.includes("danca") || texto.includes("dança") || texto.includes("dançar")) return pegarAleatorio(dancas);
  // História da arte
  if (texto.includes("historia") || texto.includes("história") || texto.includes("aconteceu")) return pegarAleatorio(historia);

  return null; // nenhuma resposta instantânea encontrada
}

// ======================= BUSCAR CONTEXTO NOS JSONs =======================
function buscarContexto(pergunta) {
  const texto = pergunta.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  const bases = [
    dancas, artes, artistas, historia, teatro, musica,
    indigena, afro, folclore, ritmos, lugares, festas,
    atividades, emocional, curiosidades
  ];

  for (const base of bases) {
    if (!base) continue;
    for (const chave in base) {
      const chaveFormatada = chave.replace(/_/g, " ");
      if (texto.includes(chaveFormatada)) {
        return base[chave].explicacao_infantil || "";
      }
    }
  }
  return "";
}

// ======================= MONTAR PROMPT PARA O GROQ =======================
function montarPromptGroq(pergunta, contextoExtra) {
  const systemPrompt = `Você é Candinho, um professor de arte de 60 anos, gentil e paciente.
- Fale frases curtas (máximo 3 linhas) para crianças de 10 anos.
- Use linguagem simples, sempre incentive a criatividade.
- Responda em português do Brasil com carinho.
- Se não souber, diga que vai pesquisar.
- NUNCA invente informações fora do contexto.`;

  const userPrompt = `Contexto extra: ${contextoExtra.slice(0, 300)}
  
Pergunta do aluno: ${pergunta}
  
Resposta do Candinho (curta, educativa e acolhedora):`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];
}

// ======================= HANDLER PRINCIPAL (HÍBRIDO) =======================
export default async function handler(req, res) {
  // 1. Apenas POST permitido
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido. Use POST." });
  }

  try {
    const { mensagem } = req.body;
    if (!mensagem || typeof mensagem !== "string") {
      return res.status(400).json({ reply: "Por favor, envie uma mensagem válida." });
    }

    // 2. Tentar resposta instantânea (JSON)
    const instantanea = respostaInstantanea(mensagem);
    if (instantanea) {
      return res.status(200).json({ reply: instantanea });
    }

    // 3. Buscar contexto adicional nos JSONs
    let contexto = buscarContexto(mensagem);
    if (!contexto) {
      contexto = "Explique de forma educativa e simples para uma criança de 10 anos.";
    }

    // 4. Chamar Groq (com chave secreta do ambiente Vercel)
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      console.error("GROQ_API_KEY não configurada nas variáveis de ambiente da Vercel.");
      return res.status(500).json({ reply: "Candinho está sem chave mágica. Peça ajuda para o professor! 🔑" });
    }

    const messages = montarPromptGroq(mensagem, contexto);
    const payload = {
      model: "llama-3.1-8b-instant",  // rápido e gratuito
      messages: messages,
      temperature: 0.7,
      max_tokens: 120,
      stream: false
    };

    const responseGroq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!responseGroq.ok) {
      const errorText = await responseGroq.text();
      console.error(`Groq API error ${responseGroq.status}:`, errorText);
      throw new Error(`Groq respondeu com erro: ${responseGroq.status}`);
    }

    const data = await responseGroq.json();
    const respostaIA = data.choices[0]?.message?.content?.trim() || "Hum, não consegui formar uma resposta agora. Tente de novo? 🎨";

    return res.status(200).json({ reply: respostaIA });

  } catch (err) {
    console.error("Erro no handler do Candinho:", err);
    return res.status(500).json({
      reply: "😅 Candinho se confundiu com os pincéis. Tente novamente!"
    });
  }
}
