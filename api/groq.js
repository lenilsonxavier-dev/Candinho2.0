// api/groq.js
import { bibliotecaCultural } from "../src/data/bibliotecaCultural.js";

// ========================================
// CONFIGURAÇÃO
// ========================================
const GITHUB_BASE = "https://raw.githubusercontent.com/lenilsonxavier-dev/Candinho2.0/main/data/";
const EUROPEANA_API_KEY = process.env.EUROPEANA_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

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
    const fetchPromises = Object.entries(JSON_FILES).map(([key, filename]) => 
        fetch(GITHUB_BASE + filename)
            .then(res => res.ok ? res.json() : {})
            .then(json => [key, json])
            .catch(() => [key, {}])
    );
    const fetchedResults = await Promise.all(fetchPromises);
    fetchedResults.forEach(([key, value]) => results[key] = value);
    cacheData = results;
    return results;
}

// ======================= BUSCA NA EUROPEANA =======================
async function buscarNaEuropeana(pergunta) {
    if (!EUROPEANA_API_KEY || EUROPEANA_API_KEY === "SUA_CHAVE_AQUI") return null;
    
    // Limpeza de busca: foca no que importa
    const palavrasIgnorar = ["o que é", "quem foi", "fale sobre", "como", "qual", "onde", "quando", "me", "uma", "foto", "imagem"];
    let palavras = pergunta.toLowerCase().split(/\s+/).filter(p => p.length > 3 && !palavrasIgnorar.includes(p));
    
    const query = encodeURIComponent(palavras.slice(0, 3).join(' '));
    if (!query) return null;

    try {
        // Mudança crucial: wskey na URL e profile portal para imagens seguras
        const url = `https://api.europeana.eu/record/v2/search.json?wskey=${EUROPEANA_API_KEY}&query=${query}&rows=1&profile=portal&qf=TYPE:IMAGE`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.items && data.items.length > 0) {
            const item = data.items[0];
            
            // Prioridade: Preview (hospedado pela Europeana, mais seguro) > Original
            let img = (item.edmPreview && item.edmPreview[0]) ? item.edmPreview[0] : 
                      (item.edmIsShownBy && item.edmIsShownBy[0]) ? item.edmIsShownBy[0] : null;

            if (!img) return null;

            return {
                texto: `Olha que legal essa obra que eu encontrei: "${item.title ? item.title[0] : 'Sem título'}"! 🎨`,
                imagem: {
                    imagemUrl: img,
                    imagemGrande: img,
                    titulo: item.title ? item.title[0] : "Obra de arte",
                    credito: item.dcCreator ? item.dcCreator[0] : "Europeana"
                }
            };
        }
    } catch (e) {
        console.error("Erro Europeana:", e);
    }
    return null;
}

// ======================= AUXILIARES DE BUSCA =======================
function responderConceitoBasico(pergunta) {
    const texto = pergunta.toLowerCase();
    const conceitos = {
        "linha": "Linha é um ponto que andou! 🎨 Ela ajuda a desenhar contornos e formas.",
        "ponto": "O ponto é a menor parte de um desenho! 🎨 Vários pontinhos juntos formam imagens.",
        "cor": "As cores dão vida aos nossos desenhos! 🎨 Temos as primárias: azul, vermelho e amarelo.",
        "forma": "Círculos, quadrados e triângulos são formas! 🎨 Usamos elas para construir tudo."
    };
    for (const [k, v] of Object.entries(conceitos)) { if (texto.includes(k)) return v; }
    return null;
}

function buscarContextoLocal(pergunta, data) {
    const texto = pergunta.toLowerCase();
    // Busca simples nos JSONs carregados
    for (const base of Object.values(data)) {
        for (const chave in base) {
            if (texto.includes(chave.replace(/_/g, " ")) && chave.length > 3) {
                return base[chave]?.explicacao_infantil || base[chave]?.descricao || String(base[chave]);
            }
        }
    }
    return null;
}

// ======================= HANDLER PRINCIPAL =======================
export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

    try {
        const { mensagem, memoria = {} } = req.body || {};
        const data = await carregarTodosJSONs();

        // 1. Prioridade: Texto (Local ou Conceitos)
        let textoResposta = buscarContextoLocal(mensagem, data) || responderConceitoBasico(mensagem);

        // 2. Busca Imagem (Independente de ter achado o texto local)
        let europeana = await buscarNaEuropeana(mensagem);

        // 3. Monta a Resposta Final
        if (europeana) {
            return res.status(200).json({
                reply: textoResposta || europeana.texto,
                image: europeana.imagem
            });
        }

        if (textoResposta) {
            return res.status(200).json({ reply: textoResposta });
        }

        // 4. Fallback IA Groq
        if (GROQ_API_KEY) {
            const responseGroq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages: [
                        { role: "system", content: "Você é o Candinho, assistente de arte infantil. Responda em até 2 frases e use um emoji 🎨" },
                        { role: "user", content: mensagem }
                    ]
                })
            });
            const dataIA = await responseGroq.json();
            return res.status(200).json({ reply: dataIA?.choices?.[0]?.message?.content || "Conte-me mais sobre arte! 🎨" });
        }

        return res.status(200).json({ reply: "Não entendi, mas vamos desenhar? 🎨" });

    } catch (err) {
        return res.status(200).json({ reply: "Minha paleta de cores caiu! 🎨 Pode repetir?" });
    }
}
