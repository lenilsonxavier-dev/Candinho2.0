// api/groq.js
import { bibliotecaCultural as libLocal } from "../src/data/bibliotecaCultural.js";
import { createClient } from 'pexels';   // 👈 Importa a biblioteca Pexels

const GITHUB_BASE = "https://raw.githubusercontent.com/lenilsonxavier-dev/Candinho2.0/main/data/";
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;  // 👈 Chave da Pexels (mantenha secreta)

let bibliotecaCache = null;

// Cliente Pexels (inicializado apenas se a chave existir)
let pexelsClient = null;
if (PEXELS_API_KEY) {
    pexelsClient = createClient(PEXELS_API_KEY);
}

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

// Extrai o nome do artista da mensagem (melhora a busca)
function extrairNomeArtista(mensagem) {
    // Remove palavras comuns e foca em possíveis nomes próprios
    const stopWords = ["quem", "foi", "fale", "sobre", "ver", "obra", "quando", "nasceu", "morreu", "mostre", "imagem", "foto", "pintura", "desenho", "quadro"];
    let palavras = mensagem.toLowerCase().replace(/[?!.,]/g, "").split(/\s+/);
    // Procura palavras que começam com letra maiúscula (indica nome próprio)
    let possiveisNomes = palavras.filter(p => p[0] === p[0].toUpperCase() && p.length > 2 && !stopWords.includes(p));
    let nome = possiveisNomes.join(" ");
    // Se não achou, usa a mensagem original (limitado a 40 chars)
    return nome || mensagem.slice(0, 40);
}

// --- BUSCA NA PEXELS (substitui a Wikimedia) ---
async function buscarNaPexels(artistaNome) {
    if (!pexelsClient || !artistaNome || artistaNome.length < 3) return null;

    try {
        // Busca a primeira foto relevante baseada no nome do artista
        const resultado = await pexelsClient.photos.search({
            query: artistaNome,
            per_page: 1,
            orientation: 'square',  // Quadrada, boa para exibição
            size: 'medium'
        });

        if (resultado.photos && resultado.photos.length > 0) {
            const foto = resultado.photos[0];
            return {
                imagemUrl: foto.src.medium,   // URL da imagem (tamanho médio)
                titulo: `Imagem de ${artistaNome} por ${foto.photographer}`,
                credito: `${foto.photographer} / Pexels`,  // Atribuição obrigatória
                autor: foto.photographer,
                urlReferencia: foto.url
            };
        }
    } catch (erro) {
        console.error("Erro na busca da Pexels:", erro);
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

        // 3. Busca Imagem na Pexels APENAS se o usuário pediu explicitamente
        let imagemResult = null;
        if (pediuImagem(mensagem)) {
            const nomeArtista = extrairNomeArtista(mensagem);
            imagemResult = await buscarNaPexels(nomeArtista);
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
