// ========================================
// CONFIGURAÇÃO 
// ========================================
const GITHUB_BASE = "https://raw.githubusercontent.com/lenilsonxavier-dev/Candinho2.0/main/data/";

const EUROPEANA_API_KEY = process.env.EUROPEANA_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const jsonFiles = {
    apoio_emocional: "apoio_emocional.json",
    arte_tecnicas: "arte_tecnicas.json",
    artes_visuais: "artes_visuais.json",
    artistas: "artistas.json",
    artistas_indigenas_afrobrasileiros: "artistas-indigenas-afrobrasileiros.json",
    artistas_mulheres_historicas: "artistas-mulheres-historicas.json",
    artistas_universais: "artistas_universais.json",
    atividades_artisticas: "atividades_artisticas.json",
    cantigas_de_roda: "cantigas_de_roda.json",
    cultura_afro_brasileira: "cultura_afro_brasileira.json",
    cultura_indigena: "cultura_indigena.json",
    curiosidades: "curiosidades.json",
    dancas: "dancas.json",
    escritoras_negras_indigenas_brasileiras: "escritoras-negras-indigenas-brasileiras.json",
    escritores_negros_indigenas_brasileiros: "escritores-negros-indigenas-brasileiros.json",
    festas_brasileiras: "festas_brasileiras.json",
    folclore: "folclore.json",
    historia_arte: "historia_arte.json",
    imaginacao_infantil: "imaginacao_infantil.json",
    literatura_conceitos: "literatura_conceitos.json",
    lugares_arte: "lugares_arte.json",
    musica: "musica.json",
    obras_famosas_mundo: "obras-famosas-mundo.json",
    obras_modernistas_brasileiras: "obras-modernistas-brasileiras.json",
    personagens_fantasticos: "personagens_fantasticos.json",
    piadas: "piadas.json",
    ritmos_musicais: "ritmos_musicais.json",
    saudacoes: "saudacoes.json",
    teatro: "teatro.json"
};

let cacheData = null;

// ========================================
// FUNÇÕES AUXILIARES
// ========================================
function normalizar(texto) {
    if (!texto) return "";
    return texto.toString().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, "").trim();
}

function extrairTexto(campo) {
    if (!campo) return "";
    return Array.isArray(campo) ? campo.join(" ") : campo;
}

async function carregarTodosJSONs() {
    if (cacheData) return cacheData;
    const results = {};
    const promises = Object.entries(jsonFiles).map(async ([key, filename]) => {
        try {
            const res = await fetch(GITHUB_BASE + filename);
            if (res.ok) results[key] = await res.json();
            else console.warn(`Arquivo não encontrado: ${filename}`);
        } catch (err) {
            console.error(`Erro ao carregar ${filename}:`, err);
        }
    });
    await Promise.all(promises);
    cacheData = results;
    return results;
}

// Busca artista nos JSONs carregados
function buscarArtistaNoAcervo(nome, data) {
    const nomeNorm = normalizar(nome);
    for (const [keyFile, conteudo] of Object.entries(data)) {
        for (const [chaveID, dados] of Object.entries(conteudo)) {
            const nomeChave = normalizar(chaveID.replace(/_/g, " "));
            const nomeItem = normalizar(dados?.nome || "");
            const palavrasChave = Array.isArray(dados?.palavras_chave) ? dados.palavras_chave.map(normalizar) : [];
            if (nomeNorm === nomeChave || nomeNorm === nomeItem || palavrasChave.some(p => p === nomeNorm)) {
                return {
                    nome: dados.nome || nomeChave,
                    biografia: extrairTexto(dados.explicacao_infantil) || 
                               extrairTexto(dados.explicacao_curta) || 
                               extrairTexto(dados.inicio) || 
                               extrairTexto(dados.quem_foi) || 
                               extrairTexto(dados.explicacao_aprofundada),
                    curiosidade: extrairTexto(dados.curiosidade),
                    dadosBrutos: dados
                };
            }
        }
    }
    return null;
}

// Busca imagem na Europeana específica para o artista + "painting"
async function buscarImagemEuropeana(artistaNome) {
    if (!EUROPEANA_API_KEY || EUROPEANA_API_KEY === "SUA_CHAVE_AQUI") return null;
    try {
        const query = `"${encodeURIComponent(artistaNome)}" AND painting`;
        const url = `https://api.europeana.eu/record/v2/search.json?wskey=${EUROPEANA_API_KEY}&query=${query}&qf=TYPE:IMAGE&rows=3`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.items && data.items.length > 0) {
            // Procura um item cujo título contenha o nome do artista (para maior confiabilidade)
            const item = data.items.find(i => i.title?.[0]?.toLowerCase().includes(artistaNome.toLowerCase())) || data.items[0];
            return {
                imagemUrl: item.edmPreview?.[0] || null,
                titulo: item.title?.[0] || `Obra de ${artistaNome}`,
                credito: item.dataProvider?.[0] || "Europeana",
                link: item.guid || null
            };
        }
        return null;
    } catch (error) {
        console.error("Erro na Europeana:", error);
        return null;
    }
}

// Extrai nome da pergunta "quem foi X"
function extrairNomeDaPergunta(texto) {
    const match = texto.match(/quem (foi|é)\s+([A-Za-zÀ-ÖØ-öø-ÿ\s]+)/i);
    if (match && match[2]) return match[2].trim().replace(/[?!.,]+$/, '');
    return null;
}

// ========================================
// HANDLER PRINCIPAL
// ========================================
export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).send();

    try {
        const { mensagem, memoria = {} } = req.body;
        const data = await carregarTodosJSONs();
        let ultimoArtista = memoria.ultimoArtista || null;
        
        // 1. Verifica se é pergunta contextual (obra famosa, nasceu, etc.)
        const isContextual = (msg) => {
            const m = msg.toLowerCase();
            return m.includes("obra") || m.includes("pintou") || m.includes("nasceu") || m.includes("morreu");
        };
        
        let respostaTexto = null;
        let imagem = null;
        let novoArtista = null;
        
        // 2. Se for contextual e temos último artista, tenta responder com dados locais
        if (isContextual(mensagem) && ultimoArtista) {
            const artista = buscarArtistaNoAcervo(ultimoArtista, data);
            if (artista && artista.dadosBrutos) {
                const dadosArt = artista.dadosBrutos;
                const perguntaLow = mensagem.toLowerCase();
                if (perguntaLow.includes("obra") && perguntaLow.includes("famosa")) {
                    const obra = dadosArt.obra_mais_famosa || (dadosArt.obras?.[0]) || "várias obras lindas";
                    respostaTexto = `🎨 A obra mais famosa de ${artista.nome} é "${obra}".`;
                } else if (perguntaLow.includes("obras") || perguntaLow.includes("pintou")) {
                    const obras = dadosArt.obras || [];
                    if (obras.length) respostaTexto = `🖼️ ${artista.nome} pintou obras como: ${obras.slice(0,3).join(", ")}.`;
                    else respostaTexto = `${artista.nome} criou muitas obras importantes!`;
                } else if (perguntaLow.includes("nasceu")) {
                    const nasc = dadosArt.nascimento || dadosArt.ano_nascimento;
                    if (nasc) respostaTexto = `📅 ${artista.nome} nasceu em ${nasc}.`;
                } else if (perguntaLow.includes("morreu")) {
                    const morte = dadosArt.falecimento || dadosArt.ano_falecimento;
                    if (morte) respostaTexto = `🕯️ ${artista.nome} faleceu em ${morte}.`;
                }
            }
        }
        
        // 3. Se não respondeu contextualmente, procura o artista na pergunta
        if (!respostaTexto) {
            const nomeArtista = extrairNomeDaPergunta(mensagem);
            if (nomeArtista) {
                const artista = buscarArtistaNoAcervo(nomeArtista, data);
                if (artista) {
                    novoArtista = artista.nome;
                    ultimoArtista = novoArtista;
                    respostaTexto = artista.biografia || artista.curiosidade || `Que tal saber mais sobre ${artista.nome}?`;
                    if (respostaTexto && respostaTexto.length > 300) respostaTexto = respostaTexto.substring(0, 300) + "...";
                    // Busca imagem na Europeana para este artista
                    imagem = await buscarImagemEuropeana(artista.nome);
                } else {
                    // Artista não encontrado no acervo – resposta amigável
                    respostaTexto = `Ainda não tenho informações sobre ${nomeArtista} no meu acervo, mas você pode pesquisar! 🦆✨`;
                    imagem = null;
                }
            } else {
                // Pergunta comum (saudação, ajuda, etc.)
                const perguntaLow = mensagem.toLowerCase();
                if (perguntaLow.includes("oi") || perguntaLow.includes("olá")) {
                    respostaTexto = "Olá! Sou o Candinho, seu amigo artista. Pergunte sobre Tarsila, Portinari, Van Gogh... 🎨";
                } else if (perguntaLow.includes("obrigado")) {
                    respostaTexto = "Por nada! Fico feliz em ajudar. 🦆💛";
                } else if (perguntaLow.includes("ajuda")) {
                    respostaTexto = "Tente perguntar: 'Quem foi Tarsila do Amaral?' ou 'Qual a obra mais famosa de Portinari?' 🎭";
                } else {
                    respostaTexto = "Não entendi. Pergunte sobre um artista, como 'Quem foi Tarsila do Amaral?' 🎨";
                }
            }
        }
        
        // 4. Retorna a resposta e a imagem (se encontrada)
        return res.status(200).json({
            reply: respostaTexto,
            image: imagem,
            artista: novoArtista || ultimoArtista
        });
        
    } catch (err) {
        console.error(err);
        return res.status(200).json({
            reply: "Puxa, tive um probleminha aqui! 🎨 Pode perguntar de novo?",
            artista: null
        });
    }
}
