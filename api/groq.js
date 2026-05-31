// api/groq.js
import { bibliotecaCultural } from "../src/data/bibliotecaCultural.js";

const GITHUB_BASE = "https://raw.githubusercontent.com/lenilsonxavier-dev/Candinho2.0/main/data/";
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const JSON_FILES = {
    artistas: "artistas.json",
    // ... seus outros arquivos aqui
};

// ======================= FUNÇÃO GOOGLE ARTS (PORTAL MÁGICO) =======================
function gerarLinkGoogleArts(pergunta) {
    const stopWords = ["quem", "foi", "fale", "sobre", "ver", "obra", "mostre", "quando", "nasceu", "morreu"];
    let palavras = pergunta.toLowerCase().replace(/[?!.,]/g, "").split(/\s+/).filter(p => p.length > 2 && !stopWords.includes(p));
    let termo = palavras.slice(0, 3).join(' ');
    
    if (!termo) return null;
    
    return {
        nome: "Google Arts & Culture",
        url: `https://artsandculture.google.com/search?q=${encodeURIComponent(termo)}`
    };
}

// ======================= BUSCA NA WIKIMEDIA (IMAGEM NO CHAT) =======================
async function buscarNaWikimedia(pergunta) {
    const stopWords = ["quem", "foi", "fale", "sobre", "ver", "obra", "mostre"];
    let palavras = pergunta.toLowerCase().replace(/[?!.,]/g, "").split(/\s+/).filter(p => p.length > 2 && !stopWords.includes(p));
    let termo = palavras.slice(0, 3).join(' ');

    if (!termo) return null;

    try {
        const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=filetype:bitmap|drawing|${encodeURIComponent(termo)}&gsrlimit=1&prop=imageinfo&iiprop=url|extmetadata&iilimit=1`;
        const response = await fetch(searchUrl);
        const data = await response.json();

        if (data.query && data.query.pages) {
            const pageId = Object.keys(data.query.pages)[0];
            const page = data.query.pages[pageId];
            if (page.imageinfo && page.imageinfo[0]) {
                const info = page.imageinfo[0];
                const meta = info.extmetadata;
                return {
                    imagemUrl: info.url,
                    titulo: meta && meta.ObjectName ? meta.ObjectName.value : "Obra de arte",
                    credito: "Wikimedia Commons"
                };
            }
        }
    } catch (e) { return null; }
    return null;
}

// ... (mantenha suas funções buscarNaBiblioteca e buscarNosJSONs aqui) ...

// ======================= HANDLER PRINCIPAL =======================
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    try {
        const { mensagem } = req.body;

        // 1. Busca imagem da Wikimedia (para o chat) e o link do Google Arts (para explorar)
        const imagemResult = await buscarNaWikimedia(mensagem);
        const linkGoogleArts = gerarLinkGoogleArts(mensagem);

        // 2. Busca Texto (Biblioteca ou JSONs)
        let textoFinal = buscarNaBiblioteca(mensagem)?.texto || await buscarNosJSONs(mensagem);

        // 3. Fallback IA Groq
        if (!textoFinal && GROQ_API_KEY) {
            const responseGroq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages: [
                        { role: "system", content: "Você é o Candinho, professor de arte infantil. Diga quem foi, nascimento e morte em 2 frases. Use emojis 🎨." },
                        { role: "user", content: mensagem }
                    ]
                })
            });
            const dataIA = await responseGroq.json();
            textoFinal = dataIA.choices[0].message.content;
        }

        // 5. Retorna para o Front-end
        return res.status(200).json({
            reply: textoFinal,
            image: imagemResult,
            googleArts: linkGoogleArts // Enviando o link aqui!
        });
        
    } catch (error) {
        return res.status(200).json({ reply: "Tive um probleminha, mas já estou bem! 🎨" });
    }
}
