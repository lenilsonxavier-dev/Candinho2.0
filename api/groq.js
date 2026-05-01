// api/groq.js
const GITHUB_BASE = "https://raw.githubusercontent.com/SEU_USUARIO/SEU_REPOSITORIO/main/api/data/";

// Lista de arquivos e suas chaves
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

async function carregarTodosJSONs() {
    if (cacheData) return cacheData;
    const results = {};
    for (const [key, filename] of Object.entries(JSON_FILES)) {
        try {
            const url = GITHUB_BASE + filename;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            results[key] = await res.json();
        } catch (err) {
            console.error(`Erro ao carregar ${filename}:`, err);
            results[key] = {};
        }
    }
    cacheData = results;
    return results;
}

function pegarAleatorio(obj) {
    if (!obj || typeof obj !== "object") return null;
    const valores = Object.values(obj);
    if (valores.length === 0) return null;
    const item = valores[Math.floor(Math.random() * valores.length)];
    if (typeof item === "object" && item.explicacao_infantil) return item.explicacao_infantil;
    return String(item);
}

function respostaInstantanea(pergunta, data) {
    const texto = pergunta.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (texto.includes("piada")) return pegarAleatorio(data.piadas);
    if (texto.includes("curiosidade")) return pegarAleatorio(data.curiosidades);
    if (texto.includes("atividade") || texto.includes("brincadeira")) return pegarAleatorio(data.atividades);
    if (texto.includes("artista") || texto.includes("pintor")) return pegarAleatorio(data.artistas);
    if (texto.includes("danca") || texto.includes("dança")) return pegarAleatorio(data.dancas);
    if (texto.includes("historia") || texto.includes("história")) return pegarAleatorio(data.historia);
    return null;
}

function buscarContexto(pergunta, data) {
    const texto = pergunta.toLowerCase();
    const bases = [
        data.dancas, data.artes, data.artistas, data.historia,
        data.teatro, data.musica, data.indigena, data.afro,
        data.folclore, data.ritmos, data.lugares, data.festas,
        data.atividades, data.emocional, data.curiosidades
    ];
    for (const base of bases) {
        if (!base) continue;
        for (const chave in base) {
            if (texto.includes(chave.replace(/_/g, " "))) {
                return base[chave].explicacao_infantil || "";
            }
        }
    }
    return "";
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Método não permitido" });
    }

    try {
        const { mensagem } = req.body;
        if (!mensagem) return res.status(400).json({ error: "Mensagem vazia" });

        // 1. Carregar todos os JSONs
        const data = await carregarTodosJSONs();

        // 2. Tenta resposta instantânea
        const instant = respostaInstantanea(mensagem, data);
        if (instant) {
            return res.status(200).json({ reply: instant });
        }

        // 3. Busca contexto específico
        let contexto = buscarContexto(mensagem, data);
        if (!contexto) contexto = "Explique de forma simples e divertida para uma criança de 10 anos.";

        // 4. Chama o Groq com prompt forçado para crianças
        const GROQ_API_KEY = process.env.GROQ_API_KEY;
        if (!GROQ_API_KEY) {
            return res.status(500).json({ error: "API key não configurada" });
        }

        const systemPrompt = `Você é Candinho, um professor de arte de 60 anos, muito gentil e paciente.
- Responda SOMENTE em português do Brasil.
- Use frases curtas (máximo 3 linhas).
- Linguagem apropriada para crianças de 10 anos.
- Sempre seja educativo, acolhedor e incentive a criatividade.
- Se não souber a resposta, diga: "Não sei, mas vou pesquisar para você!"
- NUNCA invente informações. Se o contexto abaixo não tiver a resposta, diga que não sabe.`;

        const userPrompt = `Contexto: ${contexto.slice(0, 400)}\n\nPergunta: ${mensagem}\n\nResposta do Candinho (curta, educativa, para criança):`;

        const payload = {
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.5,
            max_tokens: 100,
            stream: false
        };

        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!groqRes.ok) {
            const errorText = await groqRes.text();
            console.error("Erro Groq:", errorText);
            return res.status(500).json({ error: "Falha na IA" });
        }

        const groqData = await groqRes.json();
        let reply = groqData.choices?.[0]?.message?.content?.trim();
        if (!reply) reply = "Não consegui pensar em uma resposta agora. Tente de novo!";

        return res.status(200).json({ reply });

    } catch (err) {
        console.error("Handler error:", err);
        return res.status(500).json({ error: "Erro interno do servidor" });
    }
}
