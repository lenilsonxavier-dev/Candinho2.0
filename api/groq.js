const GITHUB_BASE = "https://raw.githubusercontent.com/lenilsonxavier-dev/Candinho2.0/main/data/";

// ======================= ARQUIVOS =======================
const JSON_FILES = {
  // Apoio e socioemocional
  apoio_emocional: "apoio_emocional.json",

  // Artes plásticas e técnicas
  arte_artista: "arte_artista.json",
  arte_tecnicas: "arte_tecnicas.json",
  artes_visuais: "artes_visuais.json",
  artistas: "artistas.json",
  artistas_universais: "artistas_universais.json",
  artistas_indigenas_afrobrasileiros:
    "artistas-indigenas-afrobrasileiros.json",
  artistas_mulheres_historicas:
    "artistas-mulheres-historicas.json",
  atividades_artisticas: "atividades_artisticas.json",

  // Cultura brasileira
  cultura_afro_brasileira:
    "cultura_afro_brasileira.json",
  cultura_indigena: "cultura_indigena.json",

  festas_brasileiras: "festas_brasileiras.json",
  folclore: "folclore.json",

  // Música e dança
  musica: "musica.json",
  ritmos_musicais: "ritmos_musicais.json",
  dancas: "dancas.json",

  // Teatro e lugares de arte
  teatro: "teatro.json",
  lugares_arte: "lugares_arte.json",

  // História da arte
  historia_arte: "historia_arte.json",

  // Obras famosas
  obras_famosas_mundo:
    "obras-famosas-mundo.json",
  obras_modernistas_brasileiras:
    "obras-modernistas-brasileiras.json",

  // Literatura
  literatura_conceitos:
    "literatura_conceitos.json",
  cantigas_de_roda: "cantigas_de_roda.json",

  escritoras_negras_indigenas_brasileiras:
    "escritoras-negras-indigenas-brasileiras.json",

  escritores_negros_indigenas_brasileiros:
    "escritores-negros-indigenas-brasileiros.json",

  // Criação infantil e imaginário
  imaginacao_infantil:
    "imaginacao_infantil.json",

  perguntas_infantis:
    "perguntas_infantis.json",

  personagens_fantasticos:
    "personagens_fantasticos.json",

  // Outros
  curiosidades: "curiosidades.json",
  piadas: "piadas.json",
  saudacoes: "saudacoes.json"
};

let cacheData = null;

// ======================= CARREGAR JSONs =======================
async function carregarTodosJSONs() {
    if (cacheData) return cacheData;

    const results = {};

    for (const [key, filename] of Object.entries(JSON_FILES)) {
        try {
            const url = GITHUB_BASE + filename;

            const res = await fetch(url);

            if (!res.ok) {
                console.warn(`Arquivo não encontrado: ${filename}`);
                results[key] = {};
                continue;
            }

            const text = await res.text();

            try {
                results[key] = JSON.parse(text);
            } catch {
                console.error(`JSON inválido em ${filename}`);
                results[key] = {};
            }

        } catch (err) {
            console.error(`Erro em ${filename}:`, err.message);
            results[key] = {};
        }
    }

    cacheData = results;
    return results;
}

// ======================= UTIL =======================
function pegarAleatorio(obj) {
    if (!obj || typeof obj !== "object") return null;
    const valores = Object.values(obj);
    if (!valores.length) return null;

    const item = valores[Math.floor(Math.random() * valores.length)];
    return item?.explicacao_infantil || String(item);
}

function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .trim();
}

// ======================= FUNÇÃO UNIVERSAL DE BUSCA (NOVA) =======================
function buscarEntidade(pergunta, data) {
  const texto = normalizar(pergunta);

  for (const categoria of Object.values(data)) {
    if (!categoria || typeof categoria !== "object")
      continue;

    for (const [chave, item] of Object.entries(categoria)) {

      // nome vindo da chave do JSON
      const nomeChave = normalizar(
        chave.replace(/_/g, " ")
      );

      // palavras-chave do item
      const palavras = Array.isArray(item?.palavras_chave)
        ? item.palavras_chave.map(normalizar)
        : [];

      // nome do artista (caso exista no JSON)
      const nome =
        normalizar(item?.nome || "");

      const encontrou =
        texto.includes(nomeChave) ||
        texto.includes(nome) ||
        palavras.some(p => texto.includes(p));

      if (encontrou) {
        return {
          chave,
          item
        };
      }
    }
  }

  return null;
}

// ======================= RESPOSTA INSTANTÂNEA (REESCRITA) =======================
function respostaInstantanea(pergunta, data) {
  const texto = normalizar(pergunta);

  // respostas rápidas por tema
  if (texto.includes("piada"))
    return pegarAleatorio(data.piadas);

  if (texto.includes("curiosidade"))
    return pegarAleatorio(data.curiosidades);

  if (texto.includes("atividade"))
    return pegarAleatorio(data.atividades_artisticas);

  if (texto.includes("danca"))
    return pegarAleatorio(data.dancas);

  if (texto.includes("historia"))
    return pegarAleatorio(data.historia_arte);

  // procura entidade
  const entidade = buscarEntidade(pergunta, data);
  if (entidade) {
    const { item } = entidade;
    return (
      item.explicacao_infantil ||
      item.quem_foi ||
      item.explicacao_curta?.[0] ||
      item.inicio?.[0] ||
      item.descricao ||
      item.texto ||
      null
    );
  }

  return null;
}

// ======================= BUSCAR CONTEXTO (REESCRITA) =======================
function buscarContexto(pergunta, data) {
  const entidade = buscarEntidade(pergunta, data);
  if (!entidade) return "";

  const { item } = entidade;
  return (
    item.explicacao_infantil ||
    item.quem_foi ||
    item.explicacao_curta?.[0] ||
    item.descricao ||
    ""
  );
}

function mesmoTema(novaPergunta, historico) {
    if (!historico.length) return true;

    const ultima = historico[historico.length - 1]?.content || "";

    const palavrasNova = novaPergunta.toLowerCase().split(" ");
    const palavrasAntiga = ultima.toLowerCase().split(" ");

    return palavrasNova.some(p => palavrasAntiga.includes(p));
}

// ========== NOVAS FUNÇÕES ==========

/**
 * Extrai o nome da última entidade mencionada pelo Candinho no histórico.
 * Retorna a chave exata como está nos JSONs (ex.: "carolina_maria_de_jesus")
 */
function extrairNomeEntidadeDoHistorico(historico, data) {
  if (!Array.isArray(historico) || !historico.length) return null;

  // Percorre as mensagens do assistente (role === "bot" ou "assistant")
  // na ordem inversa (mais recente primeiro)
  for (let i = historico.length - 1; i >= 0; i--) {
    const msg = historico[i];
    if (msg.role !== "assistant" && msg.role !== "bot") continue;

    const texto = msg.content.toLowerCase();

    // Varre todas as categorias e todas as entidades
    for (const categoria of Object.values(data)) {
      if (!categoria || typeof categoria !== "object") continue;

      for (const chave of Object.keys(categoria)) {
        const nomeDisplay = chave.replace(/_/g, " "); // ex.: "carolina maria de jesus"
        if (texto.includes(nomeDisplay)) {
          return chave; // retorna a chave original
        }
      }
    }
  }
  return null;
}

/**
 * Verifica se a pergunta é de acompanhamento e tenta extrair uma resposta direta.
 */
function responderAcompanhamento(pergunta, historico, data) {
  const texto = pergunta.toLowerCase().trim();

  // Detecta se é pergunta de acompanhamento + nascimento
  const regexFollowUp = /^(ela|ele|esse\s+artista|essa\s+artista|essa\s+escritora|esse\s+escritor|quando\s+(ela|ele)\s+nasceu|qual\s+a\s+data\s+de\s+nascimento|onde\s+(ela|ele)\s+nasceu|quando\s+nasceu)/i;

  if (!regexFollowUp.test(texto)) return null;

  // Extrai o nome da entidade do histórico
  const chaveEntidade = extrairNomeEntidadeDoHistorico(historico, data);
  if (!chaveEntidade) return null;

  // Busca a entidade correspondente no JSON
  let entidade = null;
  for (const categoria of Object.values(data)) {
    if (categoria && categoria[chaveEntidade]) {
      entidade = categoria[chaveEntidade];
      break;
    }
  }
  if (!entidade) return null;

  // Se a pergunta fala em nascimento
  if (texto.includes("nasceu") || texto.includes("nascimento")) {
    // Tenta campos comuns de data de nascimento
    const nascimento = entidade.data_nascimento ||
                       entidade.nascimento ||
                       entidade.data_de_nascimento;

    if (nascimento) {
      const nome = chaveEntidade.replace(/_/g, " ");
      return `${nome} nasceu em ${nascimento}.`;
    }
  }

  // Aqui poderíamos expandir para outros tipos de follow-up (ex.: obras, onde viveu, etc.)
  return null;
}

// ======================= HANDLER =======================
export default async function handler(req, res) {

    // 🔒 Anti-cache
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Método não permitido" });
    }

    try {
        const { mensagem, memoria = {} } = req.body || {};

        if (!mensagem || typeof mensagem !== "string") {
            return res.status(400).json({ error: "Mensagem inválida" });
        }

        // 1. JSONs
        const data = await carregarTodosJSONs();

        // 2. Resposta rápida
        const instant = respostaInstantanea(mensagem, data);
        if (instant) {
            return res.status(200).json({ reply: instant });
        }

        // ======== Pergunta de acompanhamento ========
        const respostaAcompanhamento = responderAcompanhamento(
            mensagem,
            memoria.historicoCurto || [],
            data
        );
        if (respostaAcompanhamento) {
            return res.status(200).json({ reply: respostaAcompanhamento });
        }

        // 3. Contexto (agora usa a nova função reescrita)
        const contexto = buscarContexto(mensagem, data);
        if (contexto) {
            return res.status(200).json({ reply: contexto });
        }

        // 4. Sistema
        const contextoSistema = `
Você é o Candinho, um assistente artístico infantil.

Aluno:
Nome: ${memoria.nome || "não informado"}
Idade: ${memoria.idade || "não informada"}
Interesses: ${(memoria.interesses || []).join(", ") || "não informados"}

Regras:
- Use o nome do aluno naturalmente
- Responda como professor de arte
- Linguagem simples (criança)
- Máx 3 linhas
- Não use linguagem neutra
-Não use diminutivos e nem aumentativos
-Perguntas ofensivas e violência, você responde com retomada ao tema Arte
-O seu nome é uma homenagem ao grande pintor Cândido Portinari
- Nunca invente fatos errados
`;

        // 🧠 Proteção da memória
        let historicoSeguro = [];

        if (Array.isArray(memoria.historicoCurto)) {
            if (mesmoTema(mensagem, memoria.historicoCurto)) {
                historicoSeguro = memoria.historicoCurto.slice(-4);
            } else {
                historicoSeguro = []; // limpa se mudou assunto
            }
        }

        // 5. Groq
        const GROQ_API_KEY = process.env.GROQ_API_KEY;

        if (!GROQ_API_KEY) {
            throw new Error("API KEY não configurada");
        }

        const payload = {
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: contextoSistema },
                ...historicoSeguro,
                { role: "user", content: mensagem }
            ],
            temperature: 0.4,
            max_tokens: 120
        };

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const text = await response.text();

        let dataIA;

        try {
            dataIA = JSON.parse(text);
        } catch {
            console.error("Resposta inválida da IA:", text.slice(0, 200));
            throw new Error("IA retornou formato inválido");
        }

        if (!response.ok) {
            console.error("Erro Groq:", dataIA);
            throw new Error("Erro na IA");
        }

        let reply = dataIA?.choices?.[0]?.message?.content?.trim();

        if (!reply) {
            reply = contexto || "Não consegui responder agora. Tente novamente!";
        }

        return res.status(200).json({ reply });

    } catch (err) {
        console.error("Erro geral:", err);

        return res.status(200).json({
            reply: "Hmm... minha paleta travou um pouco 🎨. Pode tentar perguntar de outro jeito?"
        });
    }
}
