// api/groq.js – Fluxo com prioridade para arte brasileira 🇧🇷
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
    const palavrasImagem = ["imagem", "foto", "mostre", "obra", "ver", "desenho", "quadro", "pintura", "ilustração", "retrato", "arte", "artista"];
    return palavrasImagem.some(p => mensagem.toLowerCase().includes(p));
}

function extrairNomeArtista(mensagem) {
    const stopWords = ["quem", "foi", "fale", "sobre", "ver", "obra", "quando", "nasceu", "morreu", "mostre", "imagem", "foto", "pintura", "desenho", "quadro", "retrato", "ilustração", "arte", "artista", "brasileiro", "brasileira"];
    let texto = mensagem.replace(/[?!.,]/g, "").toLowerCase();
    
    // Remove "mostre a obra de" e variações
    texto = texto.replace(/mostre a obra de /g, "").replace(/mostre /g, "").replace(/obra de /g, "");
    
    let palavras = texto.split(/\s+/);
    let partes = [];
    
    for (let i = 0; i < palavras.length; i++) {
        let p = palavras[i];
        if (p.length > 1 && !stopWords.includes(p)) {
            // Verifica se é um nome próprio (começa com maiúscula no original)
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
    
    // Mapeamento de artistas brasileiros populares
    const artistasBrasileiros = {
        "tarsila": "Tarsila do Amaral",
        "tarsila do amaral": "Tarsila do Amaral",
        "portinari": "Candido Portinari",
        "candido portinari": "Candido Portinari",
        "di cavalcanti": "Di Cavalcanti",
        "dicavalcanti": "Di Cavalcanti",
        "anita malfatti": "Anita Malfatti",
        "anita": "Anita Malfatti",
        "romero britto": "Romero Britto",
        "britto": "Romero Britto",
        "beatriz milhazes": "Beatriz Milhazes",
        "milhazes": "Beatriz Milhazes",
        "vik muniz": "Vik Muniz",
        "vik": "Vik Muniz",
        "candido": "Candido Portinari",
        "almeida junior": "Almeida Júnior",
        "almeida júnior": "Almeida Júnior",
        "pedro americo": "Pedro Américo",
        "pedro américo": "Pedro Américo"
    };
    
    const nomeLower = nome.toLowerCase();
    if (artistasBrasileiros[nomeLower]) {
        return artistasBrasileiros[nomeLower];
    }
    
    return nome || mensagem.slice(0, 40);
}

// ==================== APIs DOS MUSEUS ====================

// 1. Wikimedia Commons - PRIORIDADE MÁXIMA (inclui arte brasileira!)
async function buscarWikimedia(artistaNome) {
    try {
        // Primeira tentativa: busca específica com "painting" e "Brazilian"
        let termosBusca = [
            `${artistaNome} painting`,
            `"${artistaNome}"`,
            `${artistaNome} Brazilian artist`,
            `${artistaNome} obra`
        ];
        
        for (const termo of termosBusca) {
            let url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(termo)}&gsrlimit=10&prop=imageinfo&iiprop=url|mime|mediatype&iiurlwidth=800`;
            
            let res = await fetch(url);
            let data = await res.json();
            
            if (data.query && data.query.pages) {
                let pages = Object.values(data.query.pages);
                
                // Filtra imagens válidas
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
                    const titulo = imgPage.title.replace("File:", "").replace(/\.(jpg|jpeg|png|gif|webp)$/i, "");
                    
                    // Verifica se a imagem pode ser de artista brasileiro
                    const isBrazilian = titulo.toLowerCase().includes("brazil") || 
                                       titulo.toLowerCase().includes("brasil") ||
                                       artistaNome.toLowerCase().includes("tarsila") ||
                                       artistaNome.toLowerCase().includes("portinari") ||
                                       artistaNome.toLowerCase().includes("di cavalcanti");
                    
                    return {
                        imagemUrl: info.thumburl || info.url,
                        titulo: titulo,
                        autor: artistaNome,
                        museu: isBrazilian ? "Acervo Brasileiro (Wikimedia Commons)" : "Wikimedia Commons",
                        credito: isBrazilian ? "Arte brasileira - Wikimedia Commons" : "Wikimedia Commons"
                    };
                }
            }
        }
    } catch (e) {
        console.error("Erro no Wikimedia:", e);
    }
    return null;
}

// 2. Art Institute of Chicago
async function buscarChicago(termo) {
    try {
        const res = await fetch(
            `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(termo)}`
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
        return {
            imagemUrl: imagem,
            titulo: art.title,
            autor: art.artist_title,
            ano: art.date_display,
            museu: "Art Institute of Chicago",
            credito: "Art Institute of Chicago"
        };
    } catch (e) {
        console.error("Erro no Chicago:", e);
        return null;
    }
}

// 3. Metropolitan Museum of Art
async function buscarMetropolitan(termo) {
    try {
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
        return {
            imagemUrl: obra.primaryImageSmall || obra.primaryImage || null,
            titulo: obra.title || "Sem título",
            autor: obra.artistDisplayName || "Autor desconhecido",
            ano: obra.objectDate || "Data desconhecida",
            museu: "Metropolitan Museum of Art",
            credito: "Metropolitan Museum of Art"
        };
    } catch (erro) {
        console.error("Erro no Met:", erro);
        return null;
    }
}

// 4. Europeana (fallback final)
async function buscarEuropeana(artistaNome) {
    try {
        const EUROPEANA_API_KEY = process.env.EUROPEANA_API_KEY;
        if (!EUROPEANA_API_KEY) return null;
        
        const url = `https://api.europeana.eu/record/v2/search.json?wskey=${EUROPEANA_API_KEY}&query=${encodeURIComponent(artistaNome)}&reusability=open&media=true&rows=1&profile=rich`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.items && data.items.length > 0) {
            const item = data.items[0];
            const imagemUrl = item.edmPreview?.[0] || null;
            return {
                imagemUrl: imagemUrl,
                titulo: item.title?.[0] || "Sem título",
                autor: item.dcCreator?.[0] || artistaNome,
                ano: item.year?.[0] || "Data desconhecida",
                museu: "Europeana",
                credito: "Europeana"
            };
        }
    } catch (e) {
        console.error("Erro no Europeana:", e);
    }
    return null;
}

// ==================== FLUXO PRINCIPAL ====================
// Fluxo PRIORIDADE BRASIL: Wikimedia (com arte brasileira) → Met → Chicago → Europeana
async function buscarImagemFluxo(artistaNome) {
    // 1. PRIORIDADE MÁXIMA: Wikimedia (já inclui arte brasileira!)
    console.log(`🔍 Buscando obra de: ${artistaNome} (prioridade para arte brasileira)`);
    
    let resultado = await buscarWikimedia(artistaNome);
    if (resultado && resultado.imagemUrl) {
        const isBrasileiro = artistaNome.toLowerCase().includes("tarsila") ||
                             artistaNome.toLowerCase().includes("portinari") ||
                             artistaNome.toLowerCase().includes("di cavalcanti") ||
                             artistaNome.toLowerCase().includes("anita") ||
                             artistaNome.toLowerCase().includes("romero britto") ||
                             artistaNome.toLowerCase().includes("beatriz milhazes") ||
                             artistaNome.toLowerCase().includes("vik muniz");
        
        if (isBrasileiro) {
            console.log(`✅ ARTE BRASILEIRA encontrada no Wikimedia para: ${artistaNome} 🇧🇷`);
        } else {
            console.log(`✅ Imagem encontrada no Wikimedia para: ${artistaNome}`);
        }
        return resultado;
    }
    
    // 2. Tentar Metropolitan Museum
    resultado = await buscarMetropolitan(artistaNome);
    if (resultado && resultado.imagemUrl) {
        console.log(`✅ Imagem encontrada no Met Museum para: ${artistaNome}`);
        return resultado;
    }
    
    // 3. Tentar Art Institute of Chicago
    resultado = await buscarChicago(artistaNome);
    if (resultado && resultado.imagemUrl) {
        console.log(`✅ Imagem encontrada no Art Institute of Chicago para: ${artistaNome}`);
        return resultado;
    }
    
    // 4. Tentar Europeana (fallback final)
    resultado = await buscarEuropeana(artistaNome);
    if (resultado && resultado.imagemUrl) {
        console.log(`✅ Imagem encontrada no Europeana para: ${artistaNome}`);
        return resultado;
    }
    
    console.log(`❌ Nenhuma imagem encontrada para: ${artistaNome}`);
    return null;
}

// ==================== EXPORTAÇÃO DO HANDLER ====================
res.setHeader('Access-Control-Allow-Credentials', true);
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    try {
        const { mensagem } = req.body;
        const lib = await carregarBiblioteca();
        const textoBusca = mensagem.toLowerCase();
        let textoFinal = "";

        // Verifica se é pergunta sobre artista brasileiro
        const isBrasileiro = textoBusca.includes("brasileiro") || 
                             textoBusca.includes("brasileira") ||
                             textoBusca.includes("brasil") ||
                             textoBusca.includes("tarsila") ||
                             textoBusca.includes("portinari") ||
                             textoBusca.includes("di cavalcanti");

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
            let systemPrompt = "Você é o Candinho, um professor de arte para crianças de 10 anos. Responda de forma simples, gentil e muito breve (máximo 3 frases). NUNCA repita o nome do artista várias vezes. Se não souber, diga 'Não conheço esse artista ainda!'.";
            
            // Adiciona estímulo para arte brasileira
            if (isBrasileiro) {
                systemPrompt = "Você é o Candinho, um professor de arte brasileiro para crianças de 10 anos. Valorize a arte brasileira sempre que possível. Responda de forma simples, gentil e muito breve (máximo 3 frases).";
            }
            
            const responseGroq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: mensagem }
                    ],
                    temperature: 0.4,
                    max_tokens: 150
                })
            });
            const dataIA = await responseGroq.json();
            textoFinal = dataIA.choices?.[0]?.message?.content?.trim() || "";
            
            // Adiciona um toque brasileiro se for sobre arte daqui
            if (isBrasileiro && textoFinal && !textoFinal.includes("🇧🇷")) {
                textoFinal += " 🇧🇷";
            }
        }

        // 3. Busca imagem seguindo o fluxo (Wikimedia prioritário para arte brasileira)
        let imagemResult = null;
        if (pediuImagem(mensagem)) {
            const nomeArtista = extrairNomeArtista(mensagem);
            imagemResult = await buscarImagemFluxo(nomeArtista);
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
