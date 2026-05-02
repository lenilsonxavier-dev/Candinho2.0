const GITHUB_BASE = "https://raw.githubusercontent.com/lenilsonxavier-dev/lenilsonxavier-dev/main/";

// Lista de arquivos
const JSON_FILES = {
    dancas: "dancas.json",
    artes: "artes_visuais.json",
    artistas: "artistas.json",
    historia: "historia_arte.json",
    teatro: "teatro.json",
    musica: "musica.json",
    folclore: "folclore.json",
    ritmos: "ritmos_musicais.json",
    festas: "festas_brasileiras.json",
    lugares: "lugares_arte.json",
    curiosidades: "curiosidades.json",
    indigena: "cultura_indigena.json",
    afro: "cultura_afro_brasileira.json",
    atividades: "atividades_artisticas.json",
    emocional: "apoio_emocional.json",
    piadas: "piadas.json"
};

let cacheData = null;

// ======================= CARREGAR JSONS =======================
async function carregarTodosJSONs() {
    if (cacheData) return cacheData;

    const results = {};
    for (const [key, filename] of Object.entries(JSON_FILES)) {
        try {
            const url = GITHUB_BASE + filename;
            const res = await fetch(url);

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const text = await res.text();
            results[key] = JSON.parse(text);

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
        for (const chave in base) {
            if (texto.includes(chave.replace(/_/g, " "))) {
                return base[chave].explicacao_infantil || "";
            }
        }
    }

    return "";
}

// ======================= HANDLER =======================
export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Método não permitido" });
    }

    try {
        const { mensagem, memoria = {} } = req.body;

        if (!mensagem) {
            return res.status(400).json({ error: "Mensagem vazia" });
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

        // 4. Sistema com memória
        const contextoSistema = `
Você é o Candinho, um assistente artístico infantil.

Aluno:
Nome: ${memoria.nome || "não informado"}
Idade: ${memoria.idade || "não informada"}
Interesses: ${(memoria.interesses || []).join(", ") || "não informados"}

Regras:
- Use o nome naturalmente
- Responda como professor de arte
- Linguagem simples (criança)
- Máx 3 linhas
- Seja educativo e criativo
`;

        const userPrompt = `
Contexto: ${contexto}

Pergunta: ${mensagem}

Resposta curta e educativa:
`;

        // 5. Groq
        const GROQ_API_KEY = process.env.GROQ_API_KEY;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                    { role: "system", content: contextoSistema },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.5,
                max_tokens: 150
            })
        });

        const dataIA = await response.json();

        let reply = dataIA?.choices?.[0]?.message?.content?.trim();

        if (!reply) {
            reply = "Não consegui responder agora. Tente de novo!";
        }

        return res.status(200).json({ reply });

    } catch (err) {
        console.error("Erro geral:", err);
        return res.status(500).json({ error: "Erro interno" });
    }
}
