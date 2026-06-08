// api/groq.js – Versão com prioridade para obras famosas
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
    
    // Verifica se pediu uma obra específica
    const obrasEspecificas = [
        "abaporu", "operários", "antropofagia", "operarios",
        "guernica", "noite estrelada", "starry night", "starrystarry night",
        "o café", "cafe", "retirantes",
        "david", "pieta", "monalisa", "mona lisa",
        "girl with a pearl earring", "moça com brinco de pérola",
        "sunflowers", "girassóis", "the bedroom", "quarto"
    ];
    
    // Detecta obra específica e tenta extrair o artista
    for (const obra of obrasEspecificas) {
        if (texto.includes(obra)) {
            // Procura por nome de artista antes da obra
            const palavras = texto.split(/\s+/);
            for (let i = 0; i < palavras.length; i++) {
                if (palavras[i] === "da" || palavras[i] === "de" || palavras[i] === "do" || palavras[i] === "van") {
                    if (palavras[i+1]) {
                        const nomePossivel = `${palavras[i+1].charAt(0).toUpperCase() + palavras[i+1].slice(1)} ${palavras[i].charAt(0).toUpperCase() + palavras[i].slice(1)}`;
                        if (nomePossivel.length > 3) return nomePossivel;
                    }
                }
            }
        }
    }
    
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
        "vik muniz": "Vik Muniz",
        "van gogh": "Van Gogh",
        "picasso": "Pablo Picasso",
        "michelangelo": "Michelangelo",
        "leonardo": "Leonardo da Vinci",
        "leonardo da vinci": "Leonardo da Vinci",
        "vermeer": "Johannes Vermeer",
        "monet": "Claude Monet",
        "renoir": "Pierre-Auguste Renoir"
    };
    
    const nomeLower = nome.toLowerCase();
    if (artistasBrasileiros[nomeLower]) {
        return artistasBrasileiros[nomeLower];
    }
    
    return nome || mensagem.slice(0, 40);
}

// ==================== APIs DOS MUSEUS ====================

// 1. Wikimedia Commons - VERSÃO CORRIGIDA (prioriza obras famosas)
async function buscarWikimedia(artistaNome) {
    try {
        console.log(`🔍 Buscando no Wikimedia: ${artistaNome}`);
        
        // Mapeamento de obras famosas por artista (prioridade máxima)
        const obrasFamosas = {
            "Tarsila do Amaral": ["Abaporu", "Operários", "Antropofagia"],
            "Candido Portinari": ["O Café", "Retirantes", "Os Retirantes"],
            "Di Cavalcanti": ["Cinco Moças de Guaratinguetá", "Samba"],
            "Van Gogh": ["Starry Night", "Sunflowers", "The Bedroom"],
            "Pablo Picasso": ["Guernica", "Les Demoiselles d Avignon"],
            "Romero Britto": ["The Mona Lisa", "The Heart"],
            "Anita Malfatti": ["A Estudante", "O Homem Amarelo"],
            "Michelangelo": ["David", "Pieta", "Sistine Chapel"],
            "Leonardo da Vinci": ["Mona Lisa", "The Last Supper"],
            "Johannes Vermeer": ["Girl with a Pearl Earring"],
            "Claude Monet": ["Water Lilies", "Impression Sunrise"]
        };
        
        // URLs manuais de fallback para obras muito específicas
        const urlsManuais = {
            "Tarsila do Amaral Abaporu": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Tarsila_do_Amaral_-_Abaporu_1928.jpg/1024px-Tarsila_do_Amaral_-_Abaporu_1928.jpg",
            "Tarsila do Amaral Operários": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Tarsila_do_Amaral_-_Oper%C3%A1rios.jpg/1024px-Tarsila_do_Amaral_-_Oper%C3%A1rios.jpg",
            "Candido Portinari O Café": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Cafe_%28Portinari%29.jpg/800px-Cafe_%28Portinari%29.jpg",
            "Candido Portinari Retirantes": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Retirantes_Portinari.jpg/1024px-Retirantes_Portinari.jpg",
            "Van Gogh Starry Night": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/1024px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg",
            "Pablo Picasso Guernica": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/PicassoGuernica.jpg/1024px-PicassoGuernica.jpg",
            "Leonardo da Vinci Mona Lisa": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg/1024px-Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg",
            "Michelangelo David": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/David_von_Michelangelo.jpg/800px-David_von_Michelangelo.jpg"
        };
        
        // 1. PRIORIDADE MÁXIMA: Buscar obra específica famosa
        const obrasDoArtista = obrasFamosas[artistaNome] || [];
        
        for (const obra of obrasDoArtista) {
            // Verificar URL manual primeiro
            const keyManual = `${artistaNome} ${obra}`;
            if (urlsManuais[keyManual]) {
                console.log(`✅ URL manual encontrada para ${artistaNome} - ${obra}`);
                return {
                    imagemUrl: urlsManuais[keyManual],
                    titulo: `${artistaNome} - ${obra}`,
                    autor: artistaNome,
                    museu: "Wikimedia Commons (Manual)",
                    credito: "Wikimedia Commons"
                };
            }
            
            let termoBusca = `"${artistaNome}" "${obra}"`;
            let url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(termoBusca)}&gsrlimit=3&prop=imageinfo&iiprop=url|mime|mediatype&iiurlwidth=800`;
            
            let res = await fetch(url);
            let data = await res.json();
            
            if (data.query && data.query.pages) {
                let pages = Object.values(data.query.pages);
                let imagems = pages.filter(p => {
                    if (!p.imageinfo?.[0]) return false;
                    const info = p.imageinfo[0];
                    const mime = (info.mime || "").toLowerCase();
                    const media = (info.mediatype || "").toUpperCase();
                    return (media === "BITMAP" || media === "DRAWING") &&
                           (mime.includes("jpeg") || mime.includes("jpg") || mime.includes("png"));
                });
                
                if (imagems.length > 0) {
                    const imgPage = imagems[0];
                    const info = imgPage.imageinfo[0];
                    console.log(`✅ Obra famosa "${obra}" encontrada para ${artistaNome}`);
                    return {
                        imagemUrl: info.thumburl || info.url,
                        titulo: `${artistaNome} - ${obra}`,
                        autor: artistaNome,
                        museu: "Wikimedia Commons",
                        credito: "Wikimedia Commons"
                    };
                }
            }
        }
        
        // 2. SEGUNDA PRIORIDADE: Buscar por "artista painting" (qualidade)
        let termoBusca = `"${artistaNome}" painting -portrait -self`;
        let url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(termoBusca)}&gsrlimit=10&prop=imageinfo&iiprop=url|mime|mediatype&iiurlwidth=800`;
        
        let res = await fetch(url);
        let data = await res.json();
        
        if (data.query && data.query.pages) {
            let pages = Object.values(data.query.pages);
            
            // Filtra por qualidade e relevância
            let imagems = pages.filter(p => {
                if (!p.imageinfo?.[0]) return false;
                const info = p.imageinfo[0];
                const mime = (info.mime || "").toLowerCase();
                const media = (info.mediatype || "").toUpperCase();
                const title = p.title.toLowerCase();
                
                // Evita retratos, fotos, documentos
                const isBad = title.includes("portrait") || 
                              title.includes("photo") || 
                              title.includes("self") ||
                              title.includes("signature") ||
                              title.includes("stamp") ||
                              title.includes("scan") ||
                              title.includes("sketch");
                
                // Prioriza títulos que contêm "painting" ou "artwork"
                const isGood = title.includes("painting") || title.includes("artwork") || title.includes("canvas");
                
                return (media === "BITMAP" || media === "DRAWING") &&
                       (mime.includes("jpeg") || mime.includes("jpg") || mime.includes("png")) &&
                       !isBad;
            });
            
            // Ordena: as "good" primeiro
            imagems.sort((a, b) => {
                const aGood = a.title.toLowerCase().includes("painting") ? 1 : 0;
                const bGood = b.title.toLowerCase().includes("painting") ? 1 : 0;
                return bGood - aGood;
            });
            
            if (imagems.length > 0) {
                const imgPage = imagems[0];
                const info = imgPage.imageinfo[0];
                console.log(`✅ Imagem de qualidade encontrada para ${artistaNome}`);
                return {
                    imagemUrl: info.thumburl || info.url,
                    titulo: imgPage.title.replace("File:", "").split('.')[0],
                    autor: artistaNome,
                    museu: "Wikimedia Commons",
                    credito: "Wikimedia Commons"
                };
            }
        }
        
        // 3. FALLBACK: Busca normal
        termoBusca = `${artistaNome}`;
        url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(termoBusca)}&gsrlimit=5&prop=imageinfo&iiprop=url&iiurlwidth=800`;
        res = await fetch(url);
        data = await res.json();
        
        if (data.query && data.query.pages) {
            let pages = Object.values(data.query.pages);
            let imgPage = pages.find(p => p.imageinfo?.[0]?.thumburl);
            if (imgPage) {
                const info = imgPage.imageinfo[0];
                console.log(`✅ Imagem encontrada (fallback) para ${artistaNome}`);
                return {
                    imagemUrl: info.thumburl || info.url,
                    titulo: imgPage.title.replace("File:", "").split('.')[0],
                    autor: artistaNome,
                    museu: "Wikimedia Commons",
                    credito: "Wikimedia Commons"
                };
            }
        }
        
        console.log(`❌ Nenhuma imagem encontrada para: ${artistaNome}`);
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
    
    // 1. Tentar Wikimedia (já prioriza obras famosas)
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
