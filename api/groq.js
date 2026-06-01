// api/groq.js – APENAS Wikimedia Commons, com thumbnails compatíveis e filtro de formato
const { bibliotecaCultural: libLocal } = require("../src/data/bibliotecaCultural.js");

const GITHUB_BASE = "https://raw.githubusercontent.com/lenilsonxavier-dev/Candinho2.0/main/data/";
const GROQ_API_KEY = process.env.GROQ_API_KEY;

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
    const stopWords = ["quem", "foi", "fale", "sobre", "ver", "obra", "quando", "nasceu", "morreu", "mostre", "imagem", "foto", "pintura", "desenho", "quadro", "retrato", "ilustração"];
    let texto = mensagem.replace(/[?!.,]/g, "").toLowerCase();
    let palavras = texto.split(/\s+/);
    let partes = [];
    for (let i = 0; i < palavras.length; i++) {
        let p = palavras[i];
        if (p.length > 1 && !stopWords.includes(p)) {
            if (mensagem.split(/\s+/)[i] && mensagem.split(/\s+/)[i][0] === mensagem.split(/\s+/)[i][0].toUpperCase()) {
                partes.push(p);
            } else if (p === "van" || p === "da" || p === "de" || p === "do" || p === "dos") {
                partes.push(p);
            } else if (partes.length === 0 && i === palavras.length - 1) {
                partes = [p];
            }
        }
    }
    let nome = partes.join(" ").replace(/\b\w/g, l => l.toUpperCase());
    return nome || mensagem.slice(0, 40);
}

// Busca exclusiva no Wikimedia Commons com thumbnail otimizado e filtro de formato
async function buscarWikimedia(artistaNome) {
    try {
        // 1. Busca específica por "artista painting" (prioriza pinturas)
        let termoBusca = `${artistaNome} painting`;
        let url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(termoBusca)}&gsrlimit=8&prop=imageinfo&iiprop=url|mime|mediatype&iiurlwidth=800`;

        let res = await fetch(url);
        let data = await res.json();

        if (data.query && data.query.pages) {
            let pages = Object.values(data.query.pages);
            // Filtra apenas imagens compatíveis (BITMAP ou DRAWING + mime jpeg/png/gif/webp)
            let imagems = pages.filter(p => {
                if (!p.imageinfo || !p.imageinfo[0]) return false;
                const info = p.imageinfo[0];
                const mime = (info.mime || "").toLowerCase();
                const media = (info.mediatype || "").toUpperCase();
                return (media === "BITMAP" || media === "DRAWING") &&
                       (mime.includes("jpeg") || mime.includes("jpg") || mime.includes("png") || mime.includes("gif") || mime.includes("webp"));
            });

            if (imagems.length > 0) {
                const imgPage = imagems[0];
                const info = imgPage.imageinfo[0];
                const imgUrl = info.thumburl || info.url; // usa thumburl sempre que possível
                return {
                    imagemUrl: imgUrl,
                    titulo: imgPage.title.replace("File:", "").split('.')[0],
                    credito: "Wikimedia Commons (obra de arte)"
                };
            }

            // Fallback: qualquer thumbnail disponível (evita quebrar)
            let anyPage = pages.find(p => p.imageinfo && p.imageinfo[0] && p.imageinfo[0].thumburl);
            if (anyPage) {
                const info = anyPage.imageinfo[0];
                return {
                    imagemUrl: info.thumburl,
                    titulo: anyPage.title.replace("File:", "").split('.')[0],
                    credito: "Wikimedia Commons"
                };
            }
        }

        // 2. Segunda tentativa: busca mais genérica
        url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(artistaNome)}&gsrlimit=5&prop=imageinfo&iiprop=url|mime|mediatype&iiurlwidth=800`;
        res = await fetch(url);
        data = await res.json();
        if (data.query && data.query.pages) {
            let pages = Object.values(data.query.pages);
            let imgPage = pages.find(p => {
                if (!p.imageinfo || !p.imageinfo[0]) return false;
                const info = p.imageinfo[0];
                const mime = (info.mime || "").toLowerCase();
                const media = (info.mediatype || "").toUpperCase();
                return (media === "BITMAP" || media === "DRAWING") &&
                       (mime.includes("jpeg") || mime.includes("jpg") || mime.includes("png"));
            });
            if (!imgPage) imgPage = pages.find(p => p.imageinfo && p.imageinfo[0] && p.imageinfo[0].thumburl);
            if (imgPage) {
                const info = imgPage.imageinfo[0];
                return {
                    imagemUrl: info.thumburl || info.url,
                    titulo: imgPage.title.replace("File:", "").split('.')[0],
                    credito: "Wikimedia Commons"
                };
            }
        }
    } catch (e) {
        console.error("Erro no Wikimedia:", e);
    }
    return null;
}

// Nada de Pexels – apenas Wikimedia
const buscarImagem = buscarWikimedia;

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    try {
        const { mensagem } = req.body;
        const lib = await carregarBiblioteca();
        const textoBusca = mensagem.toLowerCase();
        let textoFinal = "";

        // 1. Biblioteca cultural
        for (const chave in lib) {
            const item = lib[chave];
            if (item.palavras_chave && item.palavras_chave.some(p => textoBusca.includes(p.toLowerCase()))) {
                textoFinal = `${item.inicio[0]} ${item.explicacao_curta[0]}`;
                break;
            }
        }

        // 2. Groq (IA) se necessário
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

        // 3. Busca imagem sob demanda (só Wikimedia)
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
