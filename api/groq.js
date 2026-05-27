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
    if (!EUROPEANA_API_KEY || EUROPEANA_API_KEY === "SUA_CHAVE_AQUI") return null;
    try {
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

async function buscarDetalhesEuropeana(artista) {
    if (!EUROPEANA_API_KEY || EUROPEANA_API_KEY === "SUA_CHAVE_AQUI") return null;
    try {
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
    const promises = Object.entries(jsonFiles).map(async ([key, filename]) => {
        try {
            const res = await fetch(GITHUB_BASE + filename);
            if (res.ok) results[key] = await res.json();
            else console.error(`Erro 404: ${filename}`);
        } catch (err) {
            console.error(`Erro ${filename}:`, err);
        }
    });
    await Promise.all(promises);
    cacheData = results;
    return results;
}

// Busca um artista pelo nome (retorna o objeto completo e a chave)
function buscarArtistaPorNome(nome, data) {
    const nomeNorm = normalizar(nome);
    for (const [keyFile, conteudo] of Object.entries(data)) {
        for (const [chaveID, dados] of Object.entries(conteudo)) {
            const nomeChave = normalizar(chaveID.replace(/_/g, " "));
            const nomeItem = normalizar(dados?.nome || "");
            const palavrasChave = Array.isArray(dados?.palavras_chave) ? dados.palavras_chave.map(normalizar) : [];
            if (nomeNorm === nomeChave || nomeNorm === nomeItem || palavrasChave.some(p => p === nomeNorm)) {
                return { chave: chaveID, dados };
            }
        }
    }
    return null;
}

// Extrai informações complementares (obras, nascimento, etc.) dos dados do artista
function extrairInfoArtista(dados) {
    let obras = [];
    let obraMaisFamosa = null;
    let nascimento = null;
    let falecimento = null;
    
    // Tenta extrair de campos comuns nos seus JSONs
    if (dados.obras && Array.isArray(dados.obras)) obras = dados.obras;
    else if (dados.obras_famosas && Array.isArray(dados.obras_famosas)) obras = dados.obras_famosas;
    else if (dados.principais_obras && Array.isArray(dados.principais_obras)) obras = dados.principais_obras;
    
    if (dados.obra_mais_famosa) obraMaisFamosa = dados.obra_mais_famosa;
    else if (obras.length > 0) obraMaisFamosa = obras[0];
    
    if (dados.nascimento) nascimento = dados.nascimento;
    else if (dados.ano_nascimento) nascimento = dados.ano_nascimento;
    
    if (dados.falecimento) falecimento = dados.falecimento;
    else if (dados.ano_falecimento) falecimento = dados.ano_falecimento;
    
    return { obras, obraMaisFamosa, nascimento, falecimento };
}

function responderContextual(pergunta, ultimoArtistaNome, data) {
    if (!ultimoArtistaNome) return null;
    const artistaObj = buscarArtistaPorNome(ultimoArtistaNome, data);
    if (!artistaObj) return null;
    
    const info = extrairInfoArtista(artistaObj.dados);
    const nomeArtista = artistaObj.dados.nome || ultimoArtistaNome;
    const perguntaLow = pergunta.toLowerCase();
    
    if (perguntaLow.includes("obra") && (perguntaLow.includes("famosa") || perguntaLow.includes("conhecida"))) {
        if (info.obraMaisFamosa) {
            return `🎨 A obra mais famosa de ${nomeArtista} é "${info.obraMaisFamosa}".`;
        } else if (info.obras.length) {
            return `🎨 ${nomeArtista} pintou obras como: ${info.obras.slice(0,3).join(", ")}. A mais conhecida é "${info.obras[0]}"!`;
        }
        return `🖼️ ${nomeArtista} criou várias obras, mas ainda não tenho uma lista completa aqui.`;
    }
    
    if (perguntaLow.includes("obras") || perguntaLow.includes("pintou") || perguntaLow.includes("quadros")) {
        if (info.obras.length) {
            return `🖼️ ${nomeArtista} pintou obras famosas como: ${info.obras.join(", ")}.`;
        }
        return `🖌️ ${nomeArtista} produziu muitas obras importantes! Posso buscar mais detalhes para você.`;
    }
    
    if (perguntaLow.includes("nasceu")) {
        if (info.nascimento) return `📅 ${nomeArtista} nasceu em ${info.nascimento}.`;
        return `📅 Não tenho a data de nascimento de ${nomeArtista} agora, mas você pode pesquisar!`;
    }
    
    if (perguntaLow.includes("morreu") || perguntaLow.includes("faleceu")) {
        if (info.falecimento) return `🕯️ ${nomeArtista} faleceu em ${info.falecimento}.`;
        return `🕯️ Não tenho a data de falecimento de ${nomeArtista} agora.`;
    }
    
    return null;
}

function extrairNomeDaPergunta(texto) {
    const match = texto.match(/quem (foi|é)\s+([A-Za-zÀ-ÖØ-öø-ÿ\s]+)/i);
    if (match && match[2]) return match[2].trim().replace(/[?!.,]+$/, '');
    return null;
}

function isPerguntaContextual(texto) {
    const ctx = texto.toLowerCase();
    return ctx.includes("dele") || ctx.includes("dela") || 
           (ctx.includes("obra") && (ctx.includes("famosa") || ctx.includes("pintou") || ctx.includes("quadro"))) ||
           ctx.includes("nasceu") || ctx.includes("morreu") || ctx.includes("faleceu") ||
           ctx.includes("obras") || ctx.includes("pintou");
}

function buscarNoAcervo(pergunta, data) {
    const textoBusca = normalizar(pergunta);
    if (!textoBusca) return null;
    for (const [keyFile, conteudo] of Object.entries(data)) {
        for (const [chaveID, dados] of Object.entries(conteudo)) {
            const nomeChave = normalizar(chaveID.replace(/_/g, " "));
            const nomeItem = normalizar(dados?.nome || "");
            const palavrasChave = Array.isArray(dados?.palavras_chave) ? dados.palavras_chave.map(normalizar) : [];
            const match = textoBusca.includes(nomeChave) || 
                          (nomeItem && textoBusca.includes(nomeItem)) ||
                          palavrasChave.some(p => textoBusca.includes(p));
            if (match) {
                return {
                    nome: dados.nome || nomeChave,
                    biografia: extrairTexto(dados.explicacao_infantil) || 
                               extrairTexto(dados.explicacao_curta) || 
                               extrairTexto(dados.inicio) || 
                               extrairTexto(dados.quem_foi) || 
                               extrairTexto(dados.explicacao_aprofundada),
                    curiosidade: extrairTexto(dados.curiosidade),
                    feito: extrairTexto(dados.o_que_ele_fez) || extrairTexto(dados.o_que_fez),
                    palavras_chave: palavrasChave,
                    dadosBrutos: dados
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

        // Recupera último artista do front-end
        let ultimoArtista = memoria.ultimoArtista || null;

        // 1. Tenta responder pergunta contextual (dele/dela/obra famosa) localmente
        if (isPerguntaContextual(mensagem) && ultimoArtista) {
            const respostaLocal = responderContextual(mensagem, ultimoArtista, data);
            if (respostaLocal) {
                return res.status(200).json({
                    reply: respostaLocal,
                    artista: ultimoArtista, // mantém o mesmo
                    image: null,
                    artworks: null
                });
            }
        }

        // 2. Busca no acervo local para responder pergunta normal
        const achado = buscarNoAcervo(mensagem, data);
        let contextoAdicional = "";
        let imagemEuropeana = null;
        let obrasEuropeana = null;
        let artistaNome = null;

        if (achado) {
            artistaNome = achado.nome;
            ultimoArtista = artistaNome; // atualiza o último artista
            contextoAdicional = `
                INFORMAÇÃO REAL DO ACERVO:
                Nome: ${achado.nome}
                O que fez/Biografia: ${achado.biografia}
                Curiosidade: ${achado.curiosidade}
                Feitos: ${achado.feito}
                Use estritamente os fatos acima para responder.
            `;
            imagemEuropeana = await buscarImagemEuropeana(achado.nome);
            obrasEuropeana = await buscarDetalhesEuropeana(achado.nome);
        } else {
            // Tenta extrair nome da pergunta (ex: "quem foi Tarsila")
            const nomeExtraido = extrairNomeDaPergunta(mensagem);
            if (nomeExtraido) {
                const artista = buscarArtistaPorNome(nomeExtraido, data);
                if (artista) {
                    artistaNome = artista.dados.nome || nomeExtraido;
                    ultimoArtista = artistaNome;
                    contextoAdicional = `
                        INFORMAÇÃO REAL DO ACERVO:
                        Nome: ${artista.dados.nome || nomeExtraido}
                        Use as informações do acervo para responder.
                    `;
                    imagemEuropeana = await buscarImagemEuropeana(artistaNome);
                    obrasEuropeana = await buscarDetalhesEuropeana(artistaNome);
                }
            }
        }

        // 3. Monta o prompt para a IA (Groq)
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
        
        // 4. Retorna a resposta + atualização do último artista
        return res.status(200).json({
            reply: respostaTexto,
            image: imagemEuropeana,
            artworks: obrasEuropeana,
            artista: artistaNome || ultimoArtista   // importante para o front-end guardar
        });

    } catch (err) {
        console.error(err);
        return res.status(200).json({
            reply: "Puxa, tive um probleminha aqui! 🎨 Pode perguntar de novo?",
            artista: null
        });
    }
}
