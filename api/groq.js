// api/groq.js (CommonJS – funciona sem "type": "module")
const { bibliotecaCultural: libLocal } = require("../src/data/bibliotecaCultural.js");

const GITHUB_BASE = "https://raw.githubusercontent.com/lenilsonxavier-dev/Candinho2.0/main/data/";
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

let bibliotecaCache = null;

async function carregarBiblioteca() {
    if (bibliotecaCache) return bibliotecaCache;
    try {
        const res = await fetch(`${GITHUB_BASE}bibliotecaCultural.json`);
        const libGitHub = res.ok ? await res.json() : {};
        bibliotecaCache = { ...libLocal, ...libGitHub };
    } catch (e) { bibliotecaCache = libLocal; }
    return bibliotecaCache;
}

function pediuImagem(mensagem) {
    const palavrasImagem = ["imagem", "foto", "mostre", "obra", "ver", "desenho", "quadro", "pintura", "ilustração", "retrato"];
    return palavrasImagem.some(p => mensagem.toLowerCase().includes(p));
}

function extrairNomeArtista(mensagem) {
    const stopWords = ["quem", "foi", "fale", "sobre", "ver", "obra", "quando", "nasceu", "morreu", "mostre", "imagem", "foto", "pintura", "desenho", "quadro"];
    let palavras = mensagem.toLowerCase().replace(/[?!.,]/g, "").split(/\s+/);
    let possiveisNomes = palavras.filter(p => p[0] === p[0].toUpperCase() && p.length > 2 && !stopWords.includes(p));
    return possiveisNomes.join(" ") || mensagem.slice(0, 40);
}

// Busca na Pexels usando fetch direto (sem biblioteca)
async function buscarNaPexels(artistaNome) {
    if (!PEXELS_API_KEY || !artistaNome || artistaNome.length < 3) return null;
    try {
        const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(artistaNome + " painting artwork")}&per_page=1&orientation=square&size=medium`;
        const res = await fetch(url, {
            headers: { Authorization: PEXELS_API_KEY }
        });
        const data = await res.json();
        if (data.photos && data.photos.length > 0) {
            const foto = data.photos[0];
            return {
                imagemUrl: foto.src.medium,
                titulo: `Imagem de ${artistaNome} por ${foto.photographer}`,
                credito: `${foto.photographer} / Pexels`
            };
        }
    } catch (e) {
        console.error("Erro na Pexels:", e);
    }
    return null;
}

// Fallback: Wikimedia Commons
async function buscarWikimedia(termo) {
    try {
        const stopWords = ["quem", "foi", "fale", "sobre", "ver", "obra", "quando", "nasceu", "morreu", "mostre"];
        let palavras = termo.toLowerCase().replace(/[?!.,]/g, "").split(/\s+/).filter(p => p.length > 2 && !stopWords.includes(p));
        let busca = palavras.join(" ");
        if (!busca) return null;
        const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(busca)}&gsrlimit=5&prop=imageinfo&iiprop=url|extmetadata`;
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
        console.error("Erro no Wikimedia:", e);
    }
    return null;
}

// Escolhe o mecanismo de busca (Pexels se tiver chave, senão Wikimedia)
const buscarImagem = PEXELS_API_KEY ? buscarNaPexels : buscarWikimedia;

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    try {
        const { mensagem } = req.body;
        const lib = await carregarBiblioteca();
        const textoBusca = mensagem.toLowerCase();
        let textoFinal = "";

        for (const chave in lib) {
            const item = lib[chave];
            if (item.palavras_chave && item.palavras_chave.some(p => textoBusca.includes(p.toLowerCase()))) {
                textoFinal = `${item.inicio[0]} ${item.explicacao_curta[0]}`;
                break;
            }
        }

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

        let imagemResult = null;
        if (pediuImagem(mensagem)) {
            const nomeArtista = extrairNomeArtista(mensagem);
            imagemResult = await buscarImagem(nomeArtista);
        }

        return res.status(200).json({
            reply: textoFinal || "Que pergunta curiosa! Vamos descobrir juntos? 🎨",
            image: imagemResult
        });
    } catch (error) {
        console.error("Erro Geral:", error);
        return res.status(200).json({ reply: "Ops! Minhas tintas secaram. Pode repetir? 🎨" });
    }
};
