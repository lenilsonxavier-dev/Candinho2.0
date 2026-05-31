// api/groq.js
import { bibliotecaCultural } from "../src/data/bibliotecaCultural.js";

const GITHUB_BASE = "https://raw.githubusercontent.com/lenilsonxavier-dev/Candinho2.0/main/data/";
const EUROPEANA_API_KEY = process.env.EUROPEANA_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const JSON_FILES = {
  apoio_emocional: "apoio_emocional.json",
  artistas: "artistas.json",
  historia_arte: "historia_arte.json",
  obras_famosas_mundo: "obras-famosas-mundo.json",
  // ... adicione outros se necessário
};

let cacheData = null;

async function carregarTodosJSONs() {
    if (cacheData) return cacheData;
    const results = {};
    try {
        const fetchPromises = Object.entries(JSON_FILES).map(([key, filename]) => 
            fetch(GITHUB_BASE + filename).then(res => res.ok ? res.json() : {}).catch(() => ({}))
            .then(json => [key, json])
        );
        const fetched = await Promise.all(fetchPromises);
        fetched.forEach(([key, value]) => results[key] = value);
        cacheData = results;
    } catch (e) { console.error("Erro carga JSON", e); }
    return results;
}

// ======================= BUSCA EUROPEANA (AJUSTADA) =======================
async function buscarNaEuropeana(pergunta) {
    if (!EUROPEANA_API_KEY || EUROPEANA_API_KEY === "SUA_CHAVE_AQUI") return null;
    
    const stopWords = ["quem", "foi", "fale", "sobre", "quando", "nasceu", "morreu", "ver", "obra", "quadro", "mostre"];
    let palavras = pergunta.toLowerCase().replace(/[?!.,]/g, "").split(/\s+/).filter(p => p.length > 2 && !stopWords.includes(p));
    let busca = palavras.slice(0, 3).join(' ');

    if (!busca) return null;

    try {
        // Buscamos com artwork para ser mais preciso
        const url = `https://api.europeana.eu/record/v2/search.json?wskey=${EUROPEANA_API_KEY}&query=${encodeURIComponent(busca + " artwork")}&rows=1&profile=portal&qf=TYPE:IMAGE&reusability=open`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.items && data.items.length > 0) {
            const item = data.items[0];
            const img = (item.edmPreview && item.edmPreview[0]) ? item.edmPreview[0] : 
                        (item.edmIsShownBy && item.edmIsShownBy[0]) ? item.edmIsShownBy[0] : null;

            if (!img) return null;

            // Retornamos exatamente o que o seu index.html espera
            return {
                imagemUrl: img,
                imagemGrande: img,
                titulo: item.title ? item.title[0] : "Obra de arte",
                credito: item.dcCreator ? item.dcCreator[0] : "Europeana"
            };
        }
    } catch (e) { return null; }
    return null;
}

function buscarContextoLocal(pergunta, data) {
    const texto = pergunta.toLowerCase();
    for (const base of Object.values(data)) {
        for (const chave in base) {
            if (texto.includes(chave.replace(/_/g, " ")) && chave.length > 3) {
                return base[chave]?.explicacao_infantil || base[chave]?.descricao || String(base[chave]);
            }
        }
    }
    return null;
}

// ======================= HANDLER PRINCIPAL (AJUSTADO) =======================
export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

    try {
        const { mensagem } = req.body || {};
        const data = await carregarTodosJSONs();

        // 1. Busca imagem e texto em paralelo
        const [europeanaResult, textoLocal] = await Promise.all([
            buscarNaEuropeana(mensagem),
            Promise.resolve(buscarContextoLocal(mensagem, data))
        ]);

        let respostaTexto = textoLocal;

        // 2. Se não tem texto local, chama o Groq
        if (!respostaTexto && GROQ_API_KEY) {
            const responseGroq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages: [
                        { role: "system", content: "Você é o Candinho, professor de arte infantil. Se perguntarem de um artista, diga quem foi, nascimento e morte em até 3 frases. Use emojis 🎨." },
                        { role: "user", content: mensagem }
                    ]
                })
            });
            const dataIA = await responseGroq.json();
            respostaTexto = dataIA?.choices?.[0]?.message?.content;
        }

        // 3. Retorno Final
        // Importante: europeanaResult aqui já é o objeto {imagemUrl, titulo, etc}
        return res.status(200).json({
            reply: respostaTexto || "Vamos descobrir juntos? 🎨",
            image: europeanaResult 
        });

    } catch (err) {
        return res.status(200).json({ reply: "Ops! Meus pincéis caíram. 🎨" });
    }
}
