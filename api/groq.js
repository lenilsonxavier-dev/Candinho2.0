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
  escritoras_negras_indigenas_brasileiras: "escritoras-negras-indigenas-brasileiras.json", // Verificado
  escritores_negros_indigenas_brasileiros: "escritores-negros-indigenas-brasileiros.json", // Verificado
  imaginacao_infantil: "imaginacao_infantil.json",
  perguntas_infantis: "perguntas_infantis.json",
  personagens_fantasticos: "personagens_fantasticos.json",
  curiosidades: "curiosidades.json",
  piadas: "piadas.json",
  saudacoes: "saudacoes.json"
};

let cacheData = null;

async function carregarTodosJSONs() {
    if (cacheData) return cacheData;
    const results = {};
    
    // Carregamento em paralelo para ser rápido
    const promises = Object.entries(JSON_FILES).map(async ([key, filename]) => {
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

// ======================= NOVO MOTOR DE BUSCA PROFUNDA =======================
function buscarNoAcervo(pergunta, data) {
    const textoBusca = normalizar(pergunta);
    if (!textoBusca) return null;

    // Varre cada arquivo carregado no data
    for (const [keyFile, conteudo] of Object.entries(data)) {
        // Se o conteúdo for um objeto (como escritoras.json)
        const entries = Object.entries(conteudo);
        
        for (const [chaveID, dados] of entries) {
            const nomeChave = normalizar(chaveID.replace(/_/g, " "));
            const nomeItem = normalizar(dados?.nome || "");
            const palavrasChave = Array.isArray(dados?.palavras_chave) 
                ? dados.palavras_chave.map(normalizar) 
                : [];

            // Verifica se o termo pesquisado bate com o ID, o Nome ou as Tags
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
                    feito: extrairTexto(dados.o_que_ele_fez) || extrairTexto(dados.o_que_fez)
                };
            }
        }
    }
    return null;
}

export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).send();

    try {
        const { mensagem, memoria = {} } = req.body;
        const data = await carregarTodosJSONs();

        // 1. Tenta buscar no banco de dados primeiro
        const achado = buscarNoAcervo(mensagem, data);

        let contextoAdicional = "";
        if (achado) {
            contextoAdicional = `
                INFORMAÇÃO REAL DO ACERVO:
                Nome: ${achado.nome}
                O que fez/Biografia: ${achado.biografia}
                Curiosidade: ${achado.curiosidade}
                Feitos: ${achado.feito}
                Use estritamente os fatos acima para responder.
            `;
        }

        // 2. Monta o Prompt para a IA
        const promptSistema = `
            Você é o Candinho, mentor de arte e literatura infantil.
            Homenageia Cândido Portinari.
            Público: Crianças de 10 anos.
            
            ${contextoAdicional}

            REGRAS:
            - Se houver INFORMAÇÃO REAL acima, você DEVE usá-la.
            - Se não houver informação no acervo sobre o artista, incentive a criança a pesquisar ou pergunte se ela quer saber de outro que você conhece.
            - NUNCA use linguagem neutra.
            - Máximo 3 linhas.
            - Seja muito carinhoso.
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
        return res.status(200).json({ reply: dataIA.choices[0].message.content });

    } catch (err) {
        return res.status(200).json({ reply: "Puxa, tive um probleminha aqui! 🎨 Pode perguntar de novo?" });
    }
}
