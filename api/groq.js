// api/groq.js – Versão corrigida com melhor tratamento de erros
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
    } catch (e) { 
        console.error("Erro ao carregar biblioteca:", e);
        bibliotecaCache = libLocal; 
    }
    return bibliotecaCache;
}

function pediuImagem(mensagem) {
    const palavrasImagem = ["imagem", "foto", "mostre", "obra", "ver", "desenho", "quadro", "pintura", "ilustração", "retrato", "arte", "artista"];
    return palavrasImagem.some(p => mensagem.toLowerCase().includes(p));
}

function extrairNomeArtista(mensagem) {
    const stopWords = ["quem", "foi", "fale", "sobre", "ver", "obra", "quando", "nasceu", "morreu", "mostre", "imagem", "foto", "pintura", "desenho", "quadro", "retrato", "ilustração", "arte", "artista", "brasileiro", "brasileira"];
    let texto = mensagem.replace(/[?!.,]/g, "").toLowerCase();
    
    texto = texto.replace(/mostre a obra de /g, "").replace(/mostre /g, "").replace(/obra de /g, "");
    
    let palavras = texto.split(/\s+/);
    let partes = [];
    
    for (let i = 0; i < palavras.length; i++) {
        let p = palavras[i];
        if (p.length > 1 && !stopWords.includes(p)) {
            if (mensagem.split(/\s+/)[i] && mensagem.split(/\s+/)[i][0] === mensagem.split(/\s+/)[i][0].toUpperCase()) {
                partes.push(p);
            } else if (p === "van" || p === "da" || p === "de" || p === "do" || p === "dos" || p === "das") {
                partes.push(p);
            } else if (partes.length === 0 && i === palavras.length - 1) {
                partes = [p];
            }
        }
    }
    
    let nome = partes.join(" ").replace(/\b\w/g, l => l.toUpperCase());
    
    const artistasBrasileiros = {
        "tarsila": "Tarsila do Amaral",
        "tarsila do amaral": "Tarsila do Amaral",
        "portinari": "Candido Portinari",
        "candido portinari": "Candido Portinari",
        "di cavalcanti": "Di Cavalcanti",
        "anita malfatti": "Anita Malfatti",
        "romero britto": "Romero Britto",
        "beatriz milhazes": "Beatriz Milhazes",
        "vik muniz": "Vik Muniz"
    };
    
    const nomeLower = nome.toLowerCase();
    if (artistasBrasileiros[nomeLower]) {
        return artistasBrasileiros[nomeLower];
    }
    
    return nome || mensagem.slice(0, 40);
}

// ==================== APIs DOS MUSEUS ====================

async function buscarWikimedia(artistaNome) {
    try {
        console.log(`🔍 Buscando no Wikimedia: ${artistaNome}`);
        
        let termoBusca = `${artistaNome} painting`;
        let url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(termoBusca)}&gsrlimit=8&prop=imageinfo&iiprop=url|mime|mediatype&iiurlwidth=800`;
        
        let res = await fetch(url);
        let data = await res.json();
        
        if (data.query && data.query.pages) {
            let pages = Object.values(data.query.pages);
            let imagems = pages.filter(p => {
                if (!p.imageinfo || !p.imageinfo[0]) return false;
                const info = p.imageinfo[0];
                const mime = (info.mime || "").toLowerCase();
                const media = (info.mediatype || "").toUpperCase();
                return (media === "BITMAP" || media === "DRAWING") &&
                       (mime.includes("jpeg") || mime.includes("jpg") || mime.includes("png"));
            });
            
            if (imagems.length > 0) {
                const imgPage = imagems[0];
                const info = imgPage.imageinfo[0];
                console.log(`✅ Imagem encontrada no Wikimedia`);
                return {
                    imagemUrl: info.thumburl || info.url,
                    titulo: imgPage.title.replace("File:", "").split('.')[0],
                    autor: artistaNome,
                    museu: "Wikimedia Commons",
                    credito: "Wikimedia Commons (acervo livre)"
                };
            }
        }
        
        // Segunda tentativa
        url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(artistaNome)}&gsrlimit=5&prop=imageinfo&iiprop=url&iiurlwidth=800`;
        res = await fetch(url);
        data = await res.json();
        
        if (data.query && data.query.pages) {
            let pages = Object.values(data.query.pages);
            let imgPage = pages.find(p => p.imageinfo && p.imageinfo[0] && p.imageinfo[0].thumburl);
            if (imgPage) {
                const info = imgPage.imageinfo[0];
                console.log(`✅ Imagem encontrada no Wikimedia (fallback)`);
                return {
                    imagemUrl: info.thumburl || info.url,
                    titulo: imgPage.title.replace("File:", "").split('.')[0],
                    autor: artistaNome,
                    museu: "Wikimedia Commons",
                    credito: "Wikimedia Commons"
                };
            }
        }
        
        console.log(`❌ Nenhuma imagem no Wikimedia para: ${artistaNome}`);
        return null;
    } catch (e) {
        console.error("Erro no Wikimedia:", e.message);
        return null;
    }
}

async function buscarMetropolitan(termo) {
    try {
        console.log(`🔍 Buscando no Met Museum: ${termo}`);
        
        const searchResponse = await fetch(
            `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(termo)}`
        );
        const searchData = await searchResponse.json();
        
        if (!searchData.objectIDs?.length) return null;
        
        const objectId = searchData.objectIDs[0];
        const detailResponse = await fetch(
            `https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectId}`
        );
        const obra = await detailResponse.json();
        
        const imagemUrl = obra.primaryImageSmall || obra.primaryImage || null;
        
        if (imagemUrl) {
            console.log(`✅ Imagem encontrada no Met Museum`);
            return {
                imagemUrl: imagemUrl,
                titulo: obra.title || "Sem título",
                autor: obra.artistDisplayName || "Autor desconhecido",
                ano: obra.objectDate || "",
                museu: "Metropolitan Museum of Art",
                credito: "Metropolitan Museum of Art"
            };
        }
        
        return null;
    } catch (erro) {
        console.error("Erro no Met:", erro.message);
        return null;
    }
}

async function buscarChicago(termo) {
    try {
        console.log(`🔍 Buscando no Art Institute of Chicago: ${termo}`);
        
        const res = await fetch(
            `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(termo)}&limit=1`
        );
        const data = await res.json();
        
        if (!data.data?.length) return null;
        
        const obra = data.data[0];
        const detalhe = await fetch(`https://api.artic.edu/api/v1/artworks/${obra.id}`);
        const detalheJson = await detalhe.json();
        const art = detalheJson.data;
        
        const imagem = art.image_id
            ? `https://www.artic.edu/iiif/2/${art.image_id}/full/843,/0/default.jpg`
            : null;
        
        if (imagem) {
            console.log(`✅ Imagem encontrada no Art Institute of Chicago`);
            return {
                imagemUrl: imagem,
                titulo: art.title,
                autor: art.artist_title,
                ano: art.date_display,
                museu: "Art Institute of Chicago",
                credito: "Art Institute of Chicago"
            };
        }
        
        return null;
    } catch (e) {
        console.error("Erro no Chicago:", e.message);
        return null;
    }
}

// ==================== FLUXO PRINCIPAL ====================
async function buscarImagemFluxo(artistaNome) {
    console.log(`🎨 Iniciando busca por: ${artistaNome}`);
    
    // 1. Tentar Wikimedia
    let resultado = await buscarWikimedia(artistaNome);
    if (resultado?.imagemUrl) return resultado;
    
    // 2. Tentar Metropolitan
    resultado = await buscarMetropolitan(artistaNome);
    if (resultado?.imagemUrl) return resultado;
    
    // 3. Tentar Chicago
    resultado = await buscarChicago(artistaNome);
    if (resultado?.imagemUrl) return resultado;
    
    console.log(`❌ Nenhuma imagem encontrada para: ${artistaNome}`);
    return null;
}

// ==================== HANDLER PRINCIPAL ====================
module.exports = async function handler(req, res) {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
        const { mensagem } = req.body;
        console.log(`📨 Mensagem recebida: "${mensagem}"`);
        
        if (!mensagem || mensagem.trim() === '') {
            return res.status(200).json({ 
                reply: "Digite algo para eu te ajudar! 🎨",
                image: null 
            });
        }
        
        const lib = await carregarBiblioteca();
        const textoBusca = mensagem.toLowerCase();
        let textoFinal = "";

        // Biblioteca cultural
        for (const chave in lib) {
            const item = lib[chave];
            if (item.palavras_chave && item.palavras_chave.some(p => textoBusca.includes(p.toLowerCase()))) {
                textoFinal = `${item.inicio[0]} ${item.explicacao_curta[0]}`;
                break;
            }
        }

        // IA se necessário
        if (!textoFinal && GROQ_API_KEY) {
            try {
                const responseGroq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: { 
                        "Authorization": `Bearer ${GROQ_API_KEY}`, 
                        "Content-Type": "application/json" 
                    },
                    body: JSON.stringify({
                        model: "llama-3.1-8b-instant",
                        messages: [
                            { 
                                role: "system", 
                                content: "Você é o Candinho, um professor de arte para crianças de 10 anos. Responda de forma simples, gentil e muito breve (máximo 3 frases). Se não souber, diga 'Não conheço esse artista ainda!'." 
                            },
                            { role: "user", content: mensagem }
                        ],
                        temperature: 0.4,
                        max_tokens: 150
                    })
                });
                const dataIA = await responseGroq.json();
                textoFinal = dataIA.choices?.[0]?.message?.content?.trim() || "";
            } catch (e) {
                console.error("Erro na Groq:", e.message);
            }
        }

        // Busca imagem
        let imagemResult = null;
        if (pediuImagem(mensagem)) {
            const nomeArtista = extrairNomeArtista(mensagem);
            if (nomeArtista) {
                imagemResult = await buscarImagemFluxo(nomeArtista);
            }
        }

        const resposta = {
            reply: textoFinal || "Que pergunta curiosa! Vamos descobrir juntos? 🎨",
            image: imagemResult
        };
        
        console.log(`✅ Enviando resposta: ${resposta.reply.substring(0, 50)}...`);
        return res.status(200).json(resposta);
        
    } catch (error) {
        console.error("❌ Erro Geral:", error);
        return res.status(200).json({ 
            reply: "Ops! Minhas tintas secaram. Pode repetir? 🎨",
            image: null 
        });
    }
};
