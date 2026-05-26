const GITHUB_BASE = "https://raw.githubusercontent.com/lenilsonxavier-dev/Candinho2.0/main/data/";

const JSON_FILES = {
    apoio_emocional: "apoio_emocional.json",
    arte_artista: "arte_artista.json",
    arte_tecnicas: "arte_tecnicas.json",
    artes_visuais: "artes_visuais.json",
    artistas: "artistas.json",
    artistas_universais: "artistas_universais.json",
    artistas_indigenas_afrobrasileiros: "artistas-indigenas-afrobrasileiros.json",
    artistas_mulheres_historicas: "artistas-mulheres-historicas.json",
    atividades_artisticas: "atividades_artisticas.json",
    cultura_afro_brasileira: "cultura_afro_brasileira.json",
    cultura_indigena: "cultura_indigena.json",
    festas_brasileiras: "festas_brasileiras.json",
    folclore: "folclore.json",
    musica: "musica.json",
    ritmos_musicais: "ritmos_musicais.json",
    dancas: "dancas.json",
    teatro: "teatro.json",
    lugares_arte: "lugares_arte.json",
    historia_arte: "historia_arte.json",
    obras_famosas_mundo: "obras-famosas-mundo.json",
    obras_modernistas_brasileiras: "obras-modernistas-brasileiras.json",
    literatura_conceitos: "literatura_conceitos.json",
    cantigas_de_roda: "cantigas_de_roda.json",
    escritoras_negras_indigenas_brasileiras: "escritoras-negras-indigenas-brasileiras.json",
    escritores_negros_indigenas_brasileiros: "escritores-negros-indigenas-brasileiros.json",
    imaginacao_infantil: "imaginacao_infantil.json",
    perguntas_infantis: "perguntas_infantis.json",
    personagens_fantasticos: "personagens_fantasticos.json",
    curiosidades: "curiosidades.json",
    piadas: "piadas.json",
    saudacoes: "saudacoes.json"
};

let cacheData = null;

// ======================= CARREGAR JSONs (OTIMIZADO) =======================
async function carregarTodosJSONs() {
    if (cacheData) return cacheData;

    const keys = Object.keys(JSON_FILES);
    const promises = keys.map(key => 
        fetch(GITHUB_BASE + JSON_FILES[key])
            .then(res => res.ok ? res.json() : null)
            .catch(err => {
                console.error(`Falha ao carregar ${JSON_FILES[key]}:`, err);
                return null;
            })
    );

    const contents = await Promise.all(promises);
    const results = {};

    keys.forEach((key, index) => {
        results[key] = contents[index] || {};
    });

    cacheData = results;
    return results;
}

function normalizar(texto) {
    if (!texto) return "";
    return texto.toString().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, "").trim();
}

// ======================= FUNÇÃO DE BUSCA ROBUSTA =======================
function buscarEntidade(pergunta, data) {
    const textoBusca = normalizar(pergunta);
    if (!textoBusca) return null;

    // Varre cada arquivo carregado
    for (const [nomeArquivo, conteudo] of Object.entries(data)) {
        if (!conteudo) continue;

        // Converte tudo para array para unificar a busca (seja lista ou objeto)
        const itens = Array.isArray(conteudo) ? conteudo : Object.entries(conteudo);

        for (const entrada of itens) {
            // Ajusta se a entrada for [chave, valor] ou apenas o valor
            const item = Array.isArray(entrada) ? entrada[1] : entrada;
            const chaveOriginal = Array.isArray(entrada) ? entrada[0] : "";

            const nomeItem = normalizar(item?.nome || item?.titulo || chaveOriginal.replace(/_/g, " "));
            const palavrasChave = Array.isArray(item?.palavras_chave) ? item.palavras_chave.map(normalizar) : [];
            const tags = Array.isArray(item?.tags) ? item.tags.map(normalizar) : [];

            // Critérios de match
            const matchNome = nomeItem && textoBusca.includes(nomeItem);
            const matchPalavras = palavrasChave.some(p => textoBusca.includes(p));
            const matchTags = tags.some(t => textoBusca.includes(t));

            if (matchNome || matchPalavras || matchTags) {
                console.log(`✅ Encontrado em ${nomeArquivo}:`, nomeItem);
                return item;
            }
        }
    }
    return null;
}

// ======================= RESPOSTA INSTANTÂNEA =======================
function respostaInstantanea(pergunta, data) {
    const texto = normalizar(pergunta);

    if (texto.includes("piada")) return pegarAleatorio(data.piadas);
    if (texto.includes("curiosidade")) return pegarAleatorio(data.curiosidades);
    if (texto.includes("atividade")) return pegarAleatorio(data.atividades_artisticas);

    const item = buscarEntidade(pergunta, data);
    if (item) {
        return item.explicacao_infantil || 
               item.quem_foi || 
               item.descricao || 
               item.conteudo || 
               item.texto || 
               (Array.isArray(item.explicacao_curta) ? item.explicacao_curta[0] : null);
    }
    return null;
}

function pegarAleatorio(obj) {
    if (!obj) return null;
    const valores = Array.isArray(obj) ? obj : Object.values(obj);
    if (!valores.length) return null;
    const item = valores[Math.floor(Math.random() * valores.length)];
    return typeof item === 'string' ? item : (item?.explicacao_infantil || item?.texto || item?.conteudo);
}

// ======================= HANDLER (Vercel) =======================
export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") return res.status(405).send();

    try {
        const { mensagem, memoria = {} } = req.body;
        const data = await carregarTodosJSONs();

        // 1. Tenta resposta do banco de dados primeiro
        const instantanea = respostaInstantanea(mensagem, data);
        
        // Se achou no banco, vamos usar isso como "Contexto" para a IA
        // em vez de retornar puro, para a IA poder saudar a criança.
        let contextoEncontrado = instantanea ? `Informação real do nosso acervo: ${instantanea}` : "";

        const contextoSistema = `
Você é o Candinho, mentor de arte inspirado em Cândido Portinari.
Aluno: ${memoria.nome || "Criança"}, ${memoria.idade || "10"} anos.
${contextoEncontrado}

Regras:
- Responda em Português do Brasil.
- Se houver "Informação real" acima, use-a para responder.
- NUNCA use linguagem neutra (amigues, elus).
- Máximo 3 linhas.
- Seja carinhoso e educativo.
`;

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
                    { role: "user", content: mensagem }
                ],
                temperature: 0.5
            })
        });

        const dataIA = await response.json();
        const reply = dataIA.choices[0].message.content;

        return res.status(200).json({ reply });

    } catch (err) {
        console.error(err);
        return res.status(200).json({ reply: "Minha paleta de cores misturou um pouco! 🎨 Pode repetir?" });
    }
}
