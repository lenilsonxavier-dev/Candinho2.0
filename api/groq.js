// api/groq.js (CommonJS – com URLs diretas de imagem)
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

// Busca APENAS no Wikimedia Commons (obras de arte)
async function buscarWikimedia(artistaNome) {
    try {
        // 1. Busca por "artista painting" – prioriza pinturas
        let termoBusca = `${artistaNome} painting`;
        let url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(termoBusca)}&gsrlimit=8&prop=imageinfo&iiprop=url&iiurlwidth=800`;

        let res = await fetch(url);
        let data = await res.json();

        if (data.query && data.query.pages) {
            let pages = Object.values(data.query.pages);
            // Procura uma página que tenha URL de imagem direta (termina com .jpg, .png, etc.)
            let melhor = null;
            for (let p of pages) {
                if (p.imageinfo && p.imageinfo[0]) {
                    let imgUrl = p.imageinfo[0].url;
                    // Garante que é um link direto para a imagem (não uma página)
                    if (imgUrl && (imgUrl.endsWith('.jpg') || imgUrl.endsWith('.png') || imgUrl.endsWith('.jpeg') || imgUrl.includes('/thumb/'))) {
                        // Se for thumbnail, pega a versão original ou maior
                        if (imgUrl.includes('/thumb/')) {
                            imgUrl = imgUrl.replace(/\/thumb\/(.*?)\/\d+px-(.*)$/, '/$1');
                        }
                        melhor = p;
                        break;
                    }
                }
            }
            if (!melhor) {
                melhor = pages.find(p => p.imageinfo && p.imageinfo[0]);
            }
            if (melhor) {
                let info = melhor.imageinfo[0];
                let imgUrl = info.url;
                // Se ainda for thumbnail, extrai a original (tira /thumb/...)
                if (imgUrl.includes('/thumb/')) {
                    imgUrl = imgUrl.replace(/\/thumb\/(.*?)\/\d+px-(.*)$/, '/$1');
                }
                return {
                    imagemUrl: imgUrl,
                    titulo: melhor.title.replace("File:", "").split('.')[0],
                    credito: "Wikimedia Commons (obra de arte)"
                };
            }
        }

        // 2. Fallback: busca só pelo nome do artista
        url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(artistaNome)}&gsrlimit=5&prop=imageinfo&iiprop=url&iiurlwidth=800`;
        res = await fetch(url);
        data = await res.json();
        if (data.query && data.query.pages) {
            let pages = Object.values(data.query.pages);
            let page = pages.find(p => p.imageinfo && p.imageinfo[0]);
            if (page) {
                let info = page.imageinfo[0];
                let imgUrl = info.url;
                if (imgUrl.includes('/thumb/')) {
                    imgUrl = imgUrl.replace(/\/thumb\/(.*?)\/\d+px-(.*)$/, '/$1');
                }
                return {
                    imagemUrl: imgUrl,
                    titulo: page.title.replace("File:", "").split('.')[0],
                    credito: "Wikimedia Commons"
                };
            }
        }
    } catch (e) {
        console.error("Erro no Wikimedia:", e);
    }
    return null;
}

// Fallback Pexels (se não achar no Wikimedia)
async function buscarPexels(artistaNome) {
    if (!PEXELS_API_KEY) return null;
    try {
        const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(artistaNome + " painting art")}&per_page=1&orientation=square`;
        const res = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });
        const data = await res.json();
        if (data.photos && data.photos.length > 0) {
            const foto = data.photos[0];
            return {
                imagemUrl: foto.src.medium,
                titulo: `Imagem de ${artistaNome}`,
                credito: `${foto.photographer} / Pexels`
            };
        }
    } catch(e) {}
    return null;
}

async function buscarImagem(artistaNome) {
    let img = await buscarWikimedia(artistaNome);
    if (!img && PEXELS_API_KEY) img = await buscarPexels(artistaNome);
    return img;
}

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
