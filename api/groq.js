// ========================================
// CONFIGURAÇÃO 
// ========================================
const GITHUB_BASE = "https://raw.githubusercontent.com/lenilsonxavier-dev/Candinho2.0/main/data/";

const EUROPEANA_API_KEY = process.env.EUROPEANA_API_KEY;

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

// Busca artista nos JSONs (retorna objeto completo)
function buscarArtistaNoAcervo(nome, data) {
    const nomeNorm = normalizar(nome);
    const fontesArtistas = [
        "artistas",
        "artistas_universais",
        "artistas_indigenas_afrobrasileiros",
        "artistas_mulheres_historicas"
    ];
    for (const fonte of fontesArtistas) {
        const conteudo = data[fonte];
        if (!conteudo) continue;
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
                               extrairTexto(dados.quem_foi),
                    curiosidade: extrairTexto(dados.curiosidade),
                    obra_mais_famosa: dados.obra_mais_famosa || (dados.obras?.[0]),
                    nascimento: dados.nascimento || dados.ano_nascimento,
                    falecimento: dados.falecimento || dados.ano_falecimento,
                    nacionalidade: dados.nacionalidade,
                    dadosBrutos: dados
                };
            }
        }
    }
    return null;
}

// Busca conceitos gerais (dança, arte, piada, etc.)
function buscarConceito(pergunta, data) {
    const textoNorm = normalizar(pergunta);
    // Mapeamento de palavras-chave para arquivos JSON
    const mapTema = {
        "danca": "dancas",
        "dança": "dancas",
        "arte": "artes_visuais",
        "desenho": "artes_visuais",
        "pintura": "artes_visuais",
        "escultura": "artes_visuais",
        "musica": "musica",
        "teatro": "teatro",
        "piada": "piadas",
        "piadas": "piadas",
        "curiosidade": "curiosidades",
        "folclore": "folclore"
    };
    let arquivo = null;
    for (const [palavra, arq] of Object.entries(mapTema)) {
        if (textoNorm.includes(palavra)) {
            arquivo = arq;
            break;
        }
    }
    if (!arquivo) return null;
    const conteudo = data[arquivo];
    if (!conteudo) return null;
    // Se for piadas, retorna uma aleatória
    if (arquivo === "piadas") {
        const piadasArray = Object.values(conteudo);
        if (piadasArray.length) {
            const piada = piadasArray[Math.floor(Math.random() * piadasArray.length)];
            if (typeof piada === "string") return piada;
            if (piada.explicacao_infantil) return piada.explicacao_infantil;
            if (piada.resposta) return piada.resposta;
        }
        return "😂 Não sei nenhuma piada agora!";
    }
    // Para os outros, tenta encontrar o campo "o_que_e_" ou o primeiro item
    const chaveOQue = Object.keys(conteudo).find(k => k.startsWith("o_que_e_"));
    if (chaveOQue) {
        const item = conteudo[chaveOQue];
        if (item.inicio) return item.inicio[0];
        if (item.explicacao_curta) return item.explicacao_curta[0];
    }
    // Fallback: pega o primeiro valor do arquivo
    const primeiroItem = Object.values(conteudo)[0];
    if (primeiroItem && primeiroItem.explicacao_curta) return primeiroItem.explicacao_curta[0];
    if (primeiroItem && primeiroItem.inicio) return primeiroItem.inicio[0];
    return null;
}

// Busca imagem na Europeana específica para o artista
async function buscarImagemEuropeana(artistaNome) {
    if (!EUROPEANA_API_KEY || EUROPEANA_API_KEY === "SUA_CHAVE_AQUI") return null;
    try {
        const query = `"${encodeURIComponent(artistaNome)}" AND painting`;
        const url = `https://api.europeana.eu/record/v2/search.json?wskey=${EUROPEANA_API_KEY}&query=${query}&qf=TYPE:IMAGE&rows=3`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.items && data.items.length > 0) {
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
        let respostaTexto = null;
        let imagem = null;
        let novoArtista = null;

        // 1. Verifica se é pergunta contextual curta (ex: "Em que país?", "Nacionalidade?")
        const isContextualCurta = (msg) => {
            const m = msg.toLowerCase().trim();
            return m === "país" || m === "nacionalidade" || m === "onde nasceu" || m === "ano de nascimento" ||
                   m === "em que ano nasceu" || m === "quando nasceu" || m === "ano" ||
                   m === "obra famosa" || m === "obra mais famosa";
        };
        
        if (isContextualCurta(mensagem) && ultimoArtista) {
            const artista = buscarArtistaNoAcervo(ultimoArtista, data);
            if (artista) {
                if (mensagem.toLowerCase().includes("país") || mensagem.toLowerCase().includes("nacionalidade")) {
                    if (artista.nacionalidade) respostaTexto = `${artista.nome} era de ${artista.nacionalidade}.`;
                    else respostaTexto = `Não sei a nacionalidade de ${artista.nome} agora.`;
                } else if (mensagem.toLowerCase().includes("ano") || mensagem.toLowerCase().includes("nasceu")) {
                    if (artista.nascimento) respostaTexto = `${artista.nome} nasceu em ${artista.nascimento}.`;
                    else respostaTexto = `Não tenho a data de nascimento de ${artista.nome}.`;
                } else if (mensagem.toLowerCase().includes("obra")) {
                    if (artista.obra_mais_famosa) respostaTexto = `A obra mais famosa de ${artista.nome} é "${artista.obra_mais_famosa}".`;
                    else respostaTexto = `${artista.nome} criou várias obras lindas!`;
                }
            }
        }

        // 2. Se não respondeu contextualmente, tenta buscar conceito geral (dança, arte, piada)
        if (!respostaTexto) {
            const conceito = buscarConceito(mensagem, data);
            if (conceito) {
                respostaTexto = conceito;
            }
        }

        // 3. Se ainda não, procura artista na pergunta
        if (!respostaTexto) {
            const nomeArtista = extrairNomeDaPergunta(mensagem);
            if (nomeArtista) {
                const artista = buscarArtistaNoAcervo(nomeArtista, data);
                if (artista) {
                    novoArtista = artista.nome;
                    ultimoArtista = novoArtista;
                    respostaTexto = artista.biografia || artista.curiosidade || `Que tal saber mais sobre ${artista.nome}?`;
                    if (respostaTexto && respostaTexto.length > 350) respostaTexto = respostaTexto.substring(0, 350) + "...";
                    imagem = await buscarImagemEuropeana(artista.nome);
                } else {
                    respostaTexto = `Ainda não tenho informações sobre ${nomeArtista} no meu acervo, mas você pode pesquisar! 🦆✨`;
                }
            }
        }

        // 4. Fallback para perguntas comuns (saudações, ajuda)
        if (!respostaTexto) {
            const perguntaLow = mensagem.toLowerCase();
            if (perguntaLow.includes("oi") || perguntaLow.includes("olá")) {
                respostaTexto = "Olá! Sou o Candinho. Pergunte sobre artistas, dança, arte ou peça uma piada! 🎨";
            } else if (perguntaLow.includes("obrigado")) {
                respostaTexto = "Por nada! Fico feliz em ajudar. 🦆💛";
            } else if (perguntaLow.includes("ajuda")) {
                respostaTexto = "Tente perguntar: 'Quem foi Tarsila?', 'O que é dança?', 'Conte uma piada' ou 'Qual a obra mais famosa de Portinari?' 🎭";
            } else {
                respostaTexto = "Não entendi. Pergunte sobre um artista, um conceito artístico ou peça uma piada! 🎨";
            }
        }

        // 5. Retorna a resposta
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
