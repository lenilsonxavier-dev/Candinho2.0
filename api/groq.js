// ========================================
// CONFIGURAÇÃO 
// ========================================
const GITHUB_BASE = "https://raw.githubusercontent.com/lenilsonxavier-dev/Candinho2.0/main/data/";

// ⚠️ IMPORTANTE: Coloque sua chave da Europeana no arquivo .env
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
// FUNÇÃO PARA BUSCAR IMAGENS NA EUROPEANA
// ========================================
async function buscarImagemEuropeana(termo) {
    if (!EUROPEANA_API_KEY || EUROPEANA_API_KEY === "SUA_CHAVE_AQUI") {
        console.warn("⚠️ Chave da Europeana não configurada");
        return null;
    }
    
    try {
        // Correção do parâmetro qf para "TYPE:IMAGE"
        const url = `https://api.europeana.eu/record/v2/search.json?wskey=${EUROPEANA_API_KEY}&query=${encodeURIComponent(termo)}&qf=TYPE:IMAGE&rows=3`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
            const primeiroItem = data.items[0];
            return {
                imagemUrl: primeiroItem.edmPreview?.[0] || null,
                titulo: primeiroItem.title?.[0] || termo,
                credito: primeiroItem.dataProvider?.[0] || "Europeana",
                link: primeiroItem.guid || null
            };
        }
        return null;
    } catch (error) {
        console.error("Erro ao buscar imagem na Europeana:", error);
        return null;
    }
}

// ========================================
// FUNÇÃO PARA BUSCAR MAIS DETALHES NA EUROPEANA
// ========================================
async function buscarDetalhesEuropeana(artista) {
    if (!EUROPEANA_API_KEY || EUROPEANA_API_KEY === "SUA_CHAVE_AQUI") {
        return null;
    }
    
    try {
        // Correção do parâmetro qf para "TYPE:IMAGE"
        const url = `https://api.europeana.eu/record/v2/search.json?wskey=${EUROPEANA_API_KEY}&query=who:"${encodeURIComponent(artista)}"&qf=TYPE:IMAGE&rows=5`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
            return data.items.map(item => ({
                titulo: item.title?.[0] || "Sem título",
                imagem: item.edmPreview?.[0] || null,
                data: item.year?.[0] || "Data desconhecida",
                link: item.guid || null
            }));
        }
        return null;
    } catch (error) {
        console.error("Erro ao buscar detalhes na Europeana:", error);
        return null;
    }
}

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
    
    // Correção: Alterado de "JSON_FILES" para "jsonFiles"
    const promises = Object.entries(jsonFiles).map(async ([key, filename]) => {
        try {
            const res = await fetch(GITHUB_BASE + filename);
            if (res.ok) {
                results[key] = await res.json();
            } else {
                console.error(`Erro 404 no arquivo: ${filename}`);
            }
        } catch (err) {
            console.error(`Erro ao carregar ${filename}:`, err);
        }
    });

    await Promise.all(promises);
    cacheData = results;
    return results;
}

function buscarNoAcervo(pergunta, data) {
    const textoBusca = normalizar(pergunta);
    if (!textoBusca) return null;

    for (const [keyFile, conteudo] of Object.entries(data)) {
        const entries = Object.entries(conteudo);
        
        for (const [chaveID, dados] of entries) {
            const nomeChave = normalizar(chaveID.replace(/_/g, " "));
            const nomeItem = normalizar(dados?.nome || "");
            const palavrasChave = Array.isArray(dados?.palavras_chave) 
                ? dados.palavras_chave.map(normalizar) 
                : [];

            const match = textoBusca.includes(nomeChave) || 
                          (nomeItem && textoBusca.includes(nomeItem)) ||
                          palavrasChave.some(p => textoBusca.includes(p));

            if (match) {
                console.log(`✅ Sucesso! Encontrado no arquivo ${keyFile}: ${chaveID}`);
                return {
                    nome: dados.nome || nomeChave,
                    biografia: extrairTexto(dados.explicacao_infantil) || 
                               extrairTexto(dados.explicacao_curta) || 
                               extrairTexto(dados.inicio) || 
                               extrairTexto(dados.quem_foi) || 
                               extrairTexto(dados.explicacao_aprofundada),
                    curiosidade: extrairTexto(dados.curiosidade),
                    feito: extrairTexto(dados.o_que_ele_fez) || extrairTexto(dados.o_que_fez),
                    palavras_chave: palavrasChave
                };
            }
        }
    }
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

        // 1. Busca no acervo local
        const achado = buscarNoAcervo(mensagem, data);
        
        let contextoAdicional = "";
        let imagemEuropeana = null;
        let obrasEuropeana = null;

        if (achado) {
            contextoAdicional = `
                INFORMAÇÃO REAL DO ACERVO:
                Nome: ${achado.nome}
                O que fez/Biografia: ${achado.biografia}
                Curiosidade: ${achado.curiosidade}
                Feitos: ${achado.feito}
                Use estritamente os fatos acima para responder.
            `;
            
            // 2. Busca IMAGEM na Europeana (se disponível)
            imagemEuropeana = await buscarImagemEuropeana(achado.nome);
            
            // 3. Busca OBRAS do artista na Europeana
            obrasEuropeana = await buscarDetalhesEuropeana(achado.nome);
        }

        // 4. Monta o Prompt com informações da Europeana
        let promptImagem = "";
        if (imagemEuropeana) {
            promptImagem = `\n\nIMAGEM DISPONÍVEL: ${imagemEuropeana.imagemUrl}
            Título da obra: ${imagemEuropeana.titulo}
            Fonte: ${imagemEuropeana.credito}`;
        }
        
        let promptObras = "";
        if (obrasEuropeana && obrasEuropeana.length > 0) {
            promptObras = "\n\nOBRAS RELACIONADAS:";
            obrasEuropeana.slice(0, 3).forEach((obra, idx) => {
                promptObras += `\n${idx+1}. ${obra.titulo} (${obra.data}) - ${obra.imagem}`;
            });
        }

        const promptSistema = `
            Você é o Candinho, mentor de arte e literatura infantil.
            Homenageia Cândido Portinari.
            Público: Crianças de 10 anos.
            
            ${contextoAdicional}
            ${promptImagem}
            ${promptObras}

            REGRAS:
            - Se houver INFORMAÇÃO REAL acima, você DEVE usá-la.
            - Se houver IMAGEM DISPONÍVEL, mencione que tem uma imagem para mostrar.
            - Se não houver informação no acervo, incentive a criança a pesquisar.
            - NUNCA use linguagem neutra.
            - Máximo 4 linhas.
            - Seja muito carinhoso e use emojis.
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
                    { role: "system", content: promptSistema },
                    { role: "user", content: mensagem }
                ],
                temperature: 0.4
            })
        });

        const dataIA = await response.json();
        const respostaTexto = dataIA.choices[0].message.content;
        
        // 5. Retorna a resposta JUNTO com a imagem (se existir)
        return res.status(200).json({ 
            reply: respostaTexto,
            image: imagemEuropeana,      // Para exibir no front-end
            artworks: obrasEuropeana     // Lista de obras encontradas
        });

    } catch (err) {
        console.error(err);
        return res.status(200).json({ 
            reply: "Puxa, tive um probleminha aqui! 🎨 Pode perguntar de novo?" 
        });
    }
}
