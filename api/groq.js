import { bibliotecaCultural } from "../src/data/bibliotecaCultural.js";

console.log("API iniciou");
console.log("biblioteca:", bibliotecaCultural);
console.log("registros:", Object.keys(bibliotecaCultural).length);

// ========================================
// CONFIGURAÇÃO
// ========================================
const GITHUB_BASE = "https://raw.githubusercontent.com/lenilsonxavier-dev/Candinho2.0/main/data/";
const EUROPEANA_API_KEY = process.env.EUROPEANA_API_KEY;

// ======================= ARQUIVOS =======================
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

// ======================= CARREGAR JSONs =======================
async function carregarTodosJSONs() {
    if (cacheData) return cacheData;

    const results = {};
    const fetchPromises = [];

    for (const [key, filename] of Object.entries(JSON_FILES)) {
        const promise = fetch(GITHUB_BASE + filename)
            .then(async res => {
                if (!res.ok) {
                    console.warn(`Arquivo não encontrado: ${filename}`);
                    return [key, {}];
                }
                const text = await res.text();
                try {
                    return [key, JSON.parse(text)];
                } catch {
                    console.error(`JSON inválido em ${filename}`);
                    return [key, {}];
                }
            })
            .catch(err => {
                console.error(`Erro em ${filename}:`, err.message);
                return [key, {}];
            });
        
        fetchPromises.push(promise);
    }

    const fetchedResults = await Promise.all(fetchPromises);
    for (const [key, value] of fetchedResults) {
        results[key] = value;
    }

    cacheData = results;
    return results;
}

// ======================= BUSCA NA BIBLIOTECA CULTURAL =======================
function buscarNaBibliotecaCultural(pergunta) {
    const texto = pergunta.toLowerCase();
    const palavrasChave = texto.split(/\s+/).filter(palavra => palavra.length > 3);
    
    let melhorMatch = null;
    let maiorPontuacao = 0;
    
    for (const [categoria, itens] of Object.entries(bibliotecaCultural)) {
        if (!Array.isArray(itens)) continue;
        
        for (const item of itens) {
            let pontuacao = 0;
            
            // Busca por título
            if (item.titulo) {
                const tituloLower = item.titulo.toLowerCase();
                if (texto.includes(tituloLower)) {
                    pontuacao += 10;
                } else {
                    // Busca por palavras individuais do título
                    for (const palavra of palavrasChave) {
                        if (tituloLower.includes(palavra)) {
                            pontuacao += 2;
                        }
                    }
                }
            }
            
            // Busca por descrição
            if (item.descricao) {
                const descricaoLower = item.descricao.toLowerCase();
                for (const palavra of palavrasChave) {
                    if (descricaoLower.includes(palavra)) {
                        pontuacao += 1;
                    }
                }
            }
            
            // Busca por tags/palavras-chave se existirem
            if (item.tags && Array.isArray(item.tags)) {
                for (const tag of item.tags) {
                    if (texto.includes(tag.toLowerCase())) {
                        pontuacao += 3;
                    }
                }
            }
            
            if (pontuacao > maiorPontuacao) {
                maiorPontuacao = pontuacao;
                melhorMatch = item;
            }
        }
    }
    
    if (melhorMatch && maiorPontuacao > 0) {
        // Formata a resposta de forma amigável para crianças
        if (melhorMatch.descricao) {
            return melhorMatch.descricao;
        }
        if (melhorMatch.titulo && melhorMatch.detalhes) {
            return `${melhorMatch.titulo}: ${melhorMatch.detalhes}`;
        }
        if (melhorMatch.titulo) {
            return melhorMatch.titulo;
        }
    }
    
    return null;
}

// ======================= BUSCA NA EUROPEANA (se tiver chave) =======================
async function buscarNaEuropeana(pergunta) {
    if (!EUROPEANA_API_KEY) return null;
    
    const texto = pergunta.toLowerCase();
    const palavrasChave = texto.split(/\s+/).slice(0, 5).join('+');
    
    try {
        const url = `https://api.europeana.eu/record/v2/search.json?wskey=${EUROPEANA_API_KEY}&query=${palavrasChave}&rows=1&profile=minimal`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
            const item = data.items[0];
            return item.title ? item.title[0] : null;
        }
    } catch (err) {
        console.error("Erro ao buscar na Europeana:", err.message);
    }
    
    return null;
}

// ======================= UTIL =======================
function pegarAleatorio(obj) {
    if (!obj || typeof obj !== "object") return null;
    const valores = Array.isArray(obj) ? obj : Object.values(obj);
    if (!valores.length) return null;

    const item = valores[Math.floor(Math.random() * valores.length)];
    
    // Se for objeto com explicação infantil
    if (item?.explicacao_infantil) return item.explicacao_infantil;
    // Se for string direta
    if (typeof item === "string") return item;
    // Se tiver descrição
    if (item?.descricao) return item.descricao;
    
    return String(item);
}

function respostaInstantanea(pergunta, data) {
    const texto = pergunta.toLowerCase();

    if (texto.includes("piada")) return pegarAleatorio(data.piadas);
    if (texto.includes("curiosidade")) return pegarAleatorio(data.curiosidades);
    if (texto.includes("atividade")) return pegarAleatorio(data.atividades_artisticas);
    if (texto.includes("artista")) return pegarAleatorio(data.artistas);
    if (texto.includes("dança") || texto.includes("danca")) return pegarAleatorio(data.dancas);
    if (texto.includes("história") || texto.includes("historia")) return pegarAleatorio(data.historia_arte);
    if (texto.includes("música") || texto.includes("musica")) return pegarAleatorio(data.musica);
    if (texto.includes("teatro")) return pegarAleatorio(data.teatro);
    if (texto.includes("folclore")) return pegarAleatorio(data.folclore);

    return null;
}

function buscarContexto(pergunta, data) {
    const texto = pergunta.toLowerCase();

    for (const [nomeBase, base] of Object.entries(data)) {
        if (!base || typeof base !== "object") continue;

        for (const chave in base) {
            const chaveLimpa = chave.replace(/_/g, " ");
            if (texto.includes(chaveLimpa)) {
                const resposta = base[chave]?.explicacao_infantil || 
                               base[chave]?.descricao || 
                               String(base[chave]);
                if (resposta && resposta !== "[object Object]") {
                    return resposta;
                }
            }
        }
    }

    return "";
}

function mesmoTema(novaPergunta, historico) {
    if (!historico.length) return true;

    const ultima = historico[historico.length - 1]?.content || "";
    const palavrasNova = new Set(novaPergunta.toLowerCase().split(/\s+/));
    const palavrasAntiga = ultima.toLowerCase().split(/\s+/);
    
    let matches = 0;
    for (const palavra of palavrasAntiga) {
        if (palavrasNova.has(palavra) && palavra.length > 3) {
            matches++;
        }
    }
    
    return matches > 0;
}

// ======================= HANDLER =======================
export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Método não permitido" });
    }

    try {
        const { mensagem, memoria = {} } = req.body || {};

        if (!mensagem || typeof mensagem !== "string") {
            return res.status(400).json({ error: "Mensagem inválida" });
        }

        // 1. Carregar JSONs
        const data = await carregarTodosJSONs();

        // 2. Resposta rápida dos JSONs
        const instant = respostaInstantanea(mensagem, data);
        if (instant) {
            return res.status(200).json({ reply: instant });
        }

        // 3. Buscar contexto nos JSONs
        let contexto = buscarContexto(mensagem, data);
        
        // 4. Se não achou nos JSONs, buscar na bibliotecaCultural
        if (!contexto) {
            contexto = buscarNaBibliotecaCultural(mensagem);
        }
        
        // 5. Se ainda não achou, tentar Europeana (opcional)
        if (!contexto && EUROPEANA_API_KEY) {
            contexto = await buscarNaEuropeana(mensagem);
        }
        
        // 6. Resposta direta do conteúdo encontrado
        if (contexto) {
            return res.status(200).json({ 
                reply: contexto,
                source: "biblioteca" 
            });
        }

        // 7. Sistema de prompt melhorado
        const interessesStr = (memoria.interesses || []).join(", ");
        const contextoSistema = `Você é o Candinho, um assistente artístico infantil.

Aluno: ${memoria.nome || "amiguinho"} (${memoria.idade || "idade não informada"} anos)
Interesses: ${interessesStr || "arte em geral"}

REGRAS OBRIGATÓRIAS:
- Sempre chame o aluno pelo nome
- Use linguagem simples e alegre, como um professor de arte
- Respostas curtas (máximo 3 linhas)
- NUNCA use diminutivos (ex: "desenhozinho")
- NUNCA use aumentativos (ex: "desenhão")
- Se perguntar algo ofensivo ou violento, volte ao tema arte
- Você é uma homenagem ao pintor Cândido Portinari
- Jamais invente informações - se não souber, diga que não sabe
- Use emojis de arte ocasionalmente 🎨🖌️✨`;

        // 8. Proteção da memória
        let historicoSeguro = [];
        if (Array.isArray(memoria.historicoCurto) && mesmoTema(mensagem, memoria.historicoCurto)) {
            historicoSeguro = memoria.historicoCurto.slice(-4);
        }

        // 9. Chamada Groq com fallback
        const GROQ_API_KEY = process.env.GROQ_API_KEY;
        if (!GROQ_API_KEY) {
            console.warn("API KEY não configurada, usando fallback");
            return res.status(200).json({ 
                reply: contexto || "Conte mais sobre o que você gosta na arte! 🎨" 
            });
        }

        const payload = {
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: contextoSistema },
                ...historicoSeguro,
                { role: "user", content: mensagem }
            ],
            temperature: 0.5,
            max_tokens: 150
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
            reply = contexto || "Conte mais sobre arte! O que você gosta de aprender? 🎨";
        }

        return res.status(200).json({ reply });

    } catch (err) {
        console.error("Erro geral:", err);
        return res.status(200).json({
            reply: "Ops! Minha paleta de cores ficou bagunçada 🎨 Pode repetir a pergunta?"
        });
    }
}
