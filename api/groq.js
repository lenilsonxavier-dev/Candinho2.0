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
    artistas_indigenas_afrobrasileiros: "artistas-indigenas-afrobrasileiros.json",
    artistas_mulheres_historicas: "artistas-mulheres-historicas.json",
    atividades_artisticas: "atividades_artisticas.json",
    
    // Cultura brasileira (folclore, festas, música, etc.)
    cultura_afro_brasileira: "cultura_afro_brasileira.json",
    cultura_indigena: "cultura_indigena.json",
    cultura_brasileira: "cultura_brasileira.json",        // cordel, repente, capoeira, reisado, etc.
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
    obras_famosas_mundo: "obras-famosas-mundo.json",
    obras_modernistas_brasileiras: "obras-modernistas-brasileiras.json",
    
    // Literatura
    literatura_conceitos: "literatura_conceitos.json",
    cantigas_de_roda: "cantigas_de_roda.json",
    
    // Criação infantil e imaginário
    imaginacao_infantil: "imaginacao_infantil.json",
    perguntas_infantis: "perguntas_infantis.json",       // arte_engracada, coisa_assustadora, etc.
    personagens_fantasticos: "personagens_fantasticos.json", // animais, duendes, bruxas, magos, dragões, aliens, terror, misturas do folclore
    
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

function respostaInstantanea(pergunta, data) {
    const texto = pergunta.toLowerCase();

    if (texto.includes("piada")) return pegarAleatorio(data.piadas);
    if (texto.includes("curiosidade")) return pegarAleatorio(data.curiosidades);
    if (texto.includes("atividade")) return pegarAleatorio(data.atividades);
    if (texto.includes("artista")) return pegarAleatorio(data.artistas);
    if (texto.includes("dança") || texto.includes("danca")) return pegarAleatorio(data.dancas);
    if (texto.includes("história") || texto.includes("historia")) return pegarAleatorio(data.historia);

    return null;
}

function buscarContexto(pergunta, data) {
    const texto = pergunta.toLowerCase();

    for (const base of Object.values(data)) {
        if (!base) continue;

        for (const chave in base) {
            const chaveLimpa = chave.replace(/_/g, " ");
            if (texto.includes(chaveLimpa)) {
                return base[chave]?.explicacao_infantil || "";
            }
        }
    }

    return "";
}
function mesmoTema(novaPergunta, historico) {
    if (!historico.length) return true;

    const ultima = historico[historico.length - 1]?.content || "";

    const palavrasNova = novaPergunta.toLowerCase().split(" ");
    const palavrasAntiga = ultima.toLowerCase().split(" ");

    return palavrasNova.some(p => palavrasAntiga.includes(p));
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

        // 3. Contexto
        const contexto = buscarContexto(mensagem, data);
        // 🔥 resposta direta do conteúdo (PRIORIDADE MÁXIMA)
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
