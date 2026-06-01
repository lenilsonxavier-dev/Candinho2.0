// api/groq.js
import { bibliotecaCultural as libLocal } from "../src/data/bibliotecaCultural.js";

const GITHUB_BASE = "https://raw.githubusercontent.com/lenilsonxavier-dev/Candinho2.0/main/data/";
const GROQ_API_KEY = process.env.GROQ_API_KEY;

let bibliotecaCache = null;

// Carrega os dados do GitHub para somar com a biblioteca local
async function carregarBiblioteca() {
    if (bibliotecaCache) return bibliotecaCache;
    try {
        const res = await fetch(`${GITHUB_BASE}bibliotecaCultural.json`);
        const libGitHub = res.ok ? await res.json() : {};
        bibliotecaCache = { ...libLocal, ...libGitHub };
    } catch (e) { bibliotecaCache = libLocal; }
    return bibliotecaCache;
}

// Verifica se o usuário pediu uma imagem (demanda explícita)
function pediuImagem(mensagem) {
    const palavrasImagem = ["imagem", "foto", "mostre", "obra", "ver", "desenho", "quadro", "pintura", "ilustração", "retrato"];
    const texto = mensagem.toLowerCase();
    return palavrasImagem.some(palavra => texto.includes(palavra));
}

// --- BUSCA NA WIKIMEDIA (VERSÃO TURBINADA) ---
async function buscarNaWikimedia(pergunta) {
    try {
        const stopWords = ["quem", "foi", "fale", "sobre", "ver", "obra", "quando", "nasceu", "morreu", "mostre"];
        let palavras = pergunta.toLowerCase().replace(/[?!.,]/g, "").split(/\s+/).filter(p => p.length > 2 && !stopWords.includes(p));
        let termo = palavras.join(" ");
        if (!termo) return null;

        const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(termo)}&gsrlimit=5&prop=imageinfo&iiprop=url|extmetadata`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.query && data.query.pages) {
            const pages = Object.values(data.query.pages);
            const imagePage = pages.find(p => p.imageinfo && p.imageinfo[0] && p.imageinfo[0].url);

            if (imagePage) {
                const info = imagePage.imageinfo[0];
                return {
                    imagemUrl: info.url,
                    titulo: imagePage.title.replace("File:", "").split('.')[0],
                    credito: "Wikimedia Commons"
                };
            }
        }
    } catch (e) {
        console.error("Erro Wikimedia:", e);
    }
    return null;
}

// --- HANDLER PRINCIPAL ---
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    try {
        const { mensagem } = req.body;
        const lib = await carregarBiblioteca();
        const textoBusca = mensagem.toLowerCase();
        
        let textoFinal = "";

        // 1. PRIORIDADE TOTAL: Busca na Biblioteca Cultural (Dados de Curadoria)
        for (const chave in lib) {
            const item = lib[chave];
            if (item.palavras_chave && item.palavras_chave.some(p => textoBusca.includes(p.toLowerCase()))) {
                textoFinal = `${item.inicio[0]} ${item.explicacao_curta[0]}`;
                break;
            }
        }

        // 2. Se não achou na biblioteca, chama a IA (Groq) - sem exigir formato de card
        if (!textoFinal && GROQ_API_KEY) {
            const responseGroq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages: [
                        { 
                            role: "system", 
                            content: "Você é o Candinho, um professor de arte para crianças de 10 anos. Responda de forma simples, gentil e muito breve (máximo 3 frases). NUNCA repita o nome do artista várias vezes. Se não souber, diga 'Não conheço esse artista ainda!'." 
                        },
                        { role: "user", content: mensagem }
                    ],
                    temperature: 0.4,
                    max_tokens: 150
                })
            });
            
            const dataIA = await responseGroq.json();
            textoFinal = dataIA.choices?.[0]?.message?.content?.trim() || "";
        }

        // 3. Busca Imagem na Wikimedia APENAS se o usuário pediu explicitamente
        let imagemResult = null;
        if (pediuImagem(mensagem)) {
            imagemResult = await buscarNaWikimedia(mensagem);
        }

        // 4. Retorno simplificado (sem info e sem googleArts)
        return res.status(200).json({
            reply: textoFinal || "Que pergunta curiosa! Vamos descobrir juntos? 🎨",
            image: imagemResult
        });

    } catch (error) {
        console.error("Erro Geral:", error);
        return res.status(200).json({ reply: "Ops! Minhas tintas secaram. Pode repetir? 🎨" });
    }
}
