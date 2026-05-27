import { bibliotecaCultural } from "../src/data/bibliotecaCultural.js";

console.log("API iniciou");
console.log("biblioteca:", bibliotecaCultural);
console.log("registros:", Object.keys(bibliotecaCultural).length);

// ========================================
// CONFIGURAÇÃO
// ========================================
const GITHUB_BASE = "https://raw.githubusercontent.com/lenilsonxavier-dev/Candinho2.0/main/data/";

// ✅ NOVA CHAVE EUROPEANA (formato 2025)
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
    const palavrasChave = texto.split(/\s+/).filter(palavra => palavra.length > 2);
    
    let melhorMatch = null;
    let maiorPontuacao = 0;
    
    for (const [categoria, itens] of Object.entries(bibliotecaCultural)) {
        if (!Array.isArray(itens)) continue;
        
        for (const item of itens) {
            let pontuacao = 0;
            
            if (item.titulo) {
                const tituloLower = item.titulo.toLowerCase();
                if (texto.includes(tituloLower)) {
                    pontuacao += 10;
                }
                for (const palavra of palavrasChave) {
                    if (tituloLower.includes(palavra)) {
                        pontuacao += 2;
                    }
                }
            }
            
            if (item.descricao) {
                const descricaoLower = item.descricao.toLowerCase();
                for (const palavra of palavrasChave) {
                    if (descricaoLower.includes(palavra)) {
                        pontuacao += 1;
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

// ======================= BUSCA NA EUROPEANA (NOVO MÉTODO 2025) =======================
async function buscarNaEuropeana(pergunta) {
    if (!EUROPEANA_API_KEY) {
        console.log("Europeana: chave não configurada");
        return null;
    }
    
    // Extrair palavras-chave relevantes da pergunta
    const texto = pergunta.toLowerCase();
    const palavrasIgnorar = ["o que é", "quem foi", "me fale sobre", "sobre", "para", "como", "qual", "onde", "quando"];
    let palavrasChave = texto.split(/\s+/).filter(p => p.length > 3 && !palavrasIgnorar.includes(p));
    
    if (palavrasChave.length === 0) {
        palavrasChave = texto.split(/\s+/).filter(p => p.length > 2);
    }
    
    const query = palavrasChave.slice(0, 4).join('+');
    if (!query) return null;
    
    try {
        // 🔥 NOVO MÉTODO: Header X-Api-Key em vez de parâmetro wskey
        const url = `https://api.europeana.eu/record/v2/search.json?query=${query}&rows=1&profile=minimal&qf=type:IMAGE`;
        
        console.log(`Buscando Europeana: ${query}`);
        
        const response = await fetch(url, {
            headers: {
                'X-Api-Key': EUROPEANA_API_KEY
            }
        });
        
        if (!response.ok) {
            console.error(`Europeana erro ${response.status}: ${response.statusText}`);
            return null;
        }
        
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
            const item = data.items[0];
            
            // Tentar extrair título ou descrição relevante
            if (item.title && item.title[0]) {
                const titulo = item.title[0];
                // Evitar respostas muito longas ou confusas
                if (titulo.length < 200 && !titulo.includes("http")) {
                    return `Sabia que existe uma obra interessante sobre isso? 🎨 ${titulo.substring(0, 150)}`;
                }
            }
            
            if (item.description && item.description[0]) {
                return `Encontrei algo legal! 🎨 ${item.description[0].substring(0, 150)}`;
            }
        }
        
        return null;
        
    } catch (err) {
        console.error("Erro na Europeana:", err.message);
        return null;
    }
}

// ======================= CONCEITOS BÁSICOS DE ARTE =======================
function responderConceitoBasico(pergunta) {
    const texto = pergunta.toLowerCase();
    
    const conceitos = {
        "linha": "Linha é um ponto que andou! 🎨 Na arte, a linha pode ser reta, curva, grossa, fina, ondulada. Ela ajuda a desenhar contornos e formas. Experimente fazer linhas diferentes no seu caderno!",
        
        "ponto": "O ponto é a coisa mais pequena que podemos desenhar! 🎨 É como uma semente que pode virar uma linha, uma forma ou uma obra de arte. Os pontilhistas, como Seurat, criavam quadros só com pontinhos!",
        
        "forma": "Forma é a figura que vemos no desenho, como um círculo, quadrado ou triângulo. 🎨 Na arte, usamos formas para construir tudo: uma casa, uma árvore, um rosto. Quer tentar desenhar formas diferentes?",
        
        "cor": "Cor é a luz que vemos nos objetos! 🎨 Temos as cores primárias (azul, vermelho, amarelo) que misturadas criam todas as outras. O arco-íris mostra muitas cores lindas!",
        
        "textura": "Textura é como a superfície parece ou se sente: lisa, áspera, macia, rugosa. 🎨 Na arte, podemos mostrar textura no desenho com traços especiais!",
        
        "volume": "Volume é quando uma coisa parece ter altura, largura e profundidade, como uma bola ou uma caixa. 🎨 Os artistas usam luz e sombra para dar volume aos desenhos!"
    };
    
    for (const [conceito, resposta] of Object.entries(conceitos)) {
        if (texto.includes(conceito)) {
            return resposta;
        }
    }
    
    return null;
}

// ======================= UTIL =======================
function pegarAleatorio(obj) {
    if (!obj || typeof obj !== "object") return null;
    const valores = Array.isArray(obj) ? obj : Object.values(obj);
    if (!valores.length) return null;

    const item = valores[Math.floor(Math.random() * valores.length)];
    
    if (item?.explicacao_infantil) return item.explicacao_infantil;
    if (typeof item === "string") return item;
    if (item?.descricao) return item.descricao;
    if (item?.letra) return `🎵 ${item.letra}`;
    
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
    if (texto.includes("cantiga")) return pegarAleatorio(data.cantigas_de_roda);
    if (texto.includes("teatro")) return pegarAleatorio(data.teatro);

    return null;
}

function buscarContexto(pergunta, data) {
    const texto = pergunta.toLowerCase();

    // Busca em cantigas_de_roda
    if (data.cantigas_de_roda && texto.includes("cantiga")) {
        for (const [nome, cantiga] of Object.entries(data.cantigas_de_roda)) {
            if (texto.includes(nome.toLowerCase()) || texto.includes("canoa") || texto.includes("peixe vivo")) {
                return cantiga?.letra || cantiga?.explicacao_infantil || `🎵 ${cantiga}`;
            }
        }
    }
    
    // Busca geral
    for (const [nomeBase, base] of Object.entries(data)) {
        if (!base || typeof base !== "object") continue;

        for (const chave in base) {
            const chaveLimpa = chave.replace(/_/g, " ");
            if (texto.includes(chaveLimpa) || (texto.includes(chave) && chave.length > 3)) {
                const resposta = base[chave]?.explicacao_infantil || 
                               base[chave]?.descricao || 
                               base[chave]?.letra ||
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
        
        // 4. Se não achou, buscar conceitos básicos de arte
        if (!contexto) {
            contexto = responderConceitoBasico(mensagem);
        }
        
        // 5. Se ainda não achou, buscar na bibliotecaCultural
        if (!contexto) {
            contexto = buscarNaBibliotecaCultural(mensagem);
        }
        
        // 6. 🆕 Buscar na Europeana (nova API)
        if (!contexto && EUROPEANA_API_KEY) {
            contexto = await buscarNaEuropeana(mensagem);
        }
        
        // 7. Resposta direta
        if (contexto) {
            return res.status(200).json({ 
                reply: contexto
            });
        }

        // 8. Sistema de prompt
        const interessesStr = (memoria.interesses || []).join(", ");
        const contextoSistema = `Você é o Candinho, um assistente artístico infantil.

Aluno: ${memoria.nome || "amiguinho"} (${memoria.idade || "?"} anos)

REGRAS:
- Fale como um professor de arte animado
- Máximo 2 frases por resposta
- NUNCA use diminutivos (desenhozinho, pinturinha)
- NUNCA use aumentativos
- Se perguntar sobre cantiga de roda, responda com a letra
- Se não souber algo, diga "Não sei essa ainda! Quer me ensinar ou falar sobre arte?"
- Use um emoji de arte por resposta 🎨

EXEMPLOS:
Aluno: "O que é linha?"
Você: "Linha é um ponto que andou! 🎨 Pode ser reta, curva ou ondulada."

Aluno: "Quem foi Tarsila?"
Você: "Tarsila do Amaral foi uma pintora brasileira que amava cores! 🎨 Ela pintou o Abaporu."`;

        // 9. Memória
        let historicoSeguro = [];
        if (Array.isArray(memoria.historicoCurto) && mesmoTema(mensagem, memoria.historicoCurto)) {
            historicoSeguro = memoria.historicoCurto.slice(-4);
        }

        // 10. Groq
        const GROQ_API_KEY = process.env.GROQ_API_KEY;
        if (!GROQ_API_KEY) {
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
            reply: "Ops! Minha paleta bagunçou 🎨 Pode repetir?"
        });
    }
}
