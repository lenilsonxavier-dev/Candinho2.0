// api/groq.js
import { bibliotecaCultural as libLocal } from "../src/data/bibliotecaCultural.js";

const GITHUB_BASE = "https://raw.githubusercontent.com/lenilsonxavier-dev/Candinho2.0/main/data/";
const GROQ_API_KEY = process.env.GROQ_API_KEY;

let bibliotecaCache = null;

async function carregarBiblioteca() {
    if (bibliotecaCache) return bibliotecaCache;
    try {
        const res = await fetch(`${GITHUB_BASE}bibliotecaCultural.json`);
        if (res.ok) {
            const libGitHub = await res.json();
            bibliotecaCache = { ...libLocal, ...libGitHub };
        } else { bibliotecaCache = libLocal; }
    } catch (e) { bibliotecaCache = libLocal; }
    return bibliotecaCache;
}

async function buscarNaWikimedia(pergunta) {
    try {
        const stopWords = ["quem", "foi", "fale", "sobre", "ver", "obra", "quadro", "pintura", "tarsila", "pablo"];
        let palavras = pergunta.toLowerCase().replace(/[?!.,]/g, "").split(/\s+/).filter(p => p.length > 2 && !stopWords.includes(p));
        let termo = palavras.slice(0, 3).join(' ');
        if (!termo) return null;

        const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=filetype:bitmap|${encodeURIComponent(termo)}&gsrlimit=1&prop=imageinfo&iiprop=url|extmetadata`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.query && data.query.pages) {
            const page = Object.values(data.query.pages)[0];
            const info = page.imageinfo[0];
            return {
                imagemUrl: info.url,
                titulo: info.extmetadata?.ObjectName?.value.replace(/<\/?[^>]+(>|$)/g, "") || "Obra de arte",
                credito: "Wikimedia Commons"
            };
        }
    } catch (e) { return null; }
    return null;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    try {
        const { mensagem } = req.body;
        const [imagemResult, lib] = await Promise.all([buscarNaWikimedia(mensagem), carregarBiblioteca()]);

        let infoExtra = { nascimento: "", morte: "", estilo: "" };
        let textoFinal = "";

        // Busca na biblioteca
        const textoBusca = mensagem.toLowerCase();
        for (const chave in lib) {
            const item = lib[chave];
            if (item.palavras_chave && item.palavras_chave.some(p => textoBusca.includes(p.toLowerCase()))) {
                textoFinal = `${item.inicio[0]} ${item.explicacao_curta[0]}`;
                infoExtra = { nascimento: item.ano_nascimento, morte: item.ano_falecimento, estilo: item.categoria };
                break;
            }
        }

        // Se não achou na lib, chama o Groq pedindo os dados estruturados
        if (!textoFinal && GROQ_API_KEY) {
            const responseGroq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages: [
                        { role: "system", content: "Você é o Candinho, assistente de arte infantil. Responda quem foi o artista em 2 frases. IMPORTANTE: No final da resposta, adicione sempre os dados neste formato exato: [NASCIMENTO: ano] [MORTE: ano] [ESTILO: estilo]." },
                        { role: "user", content: mensagem }
                    ]
                })
            });
            const dataIA = await responseGroq.json();
            const rawTexto = dataIA.choices?.[0]?.message?.content || "";
            
            // Extrai os dados das etiquetas [ ]
            infoExtra.nascimento = rawTexto.match(/\[NASCIMENTO: (.*?)\]/)?.[1] || "Desconhecido";
            infoExtra.morte = rawTexto.match(/\[MORTE: (.*?)\]/)?.[1] || "---";
            infoExtra.estilo = rawTexto.match(/\[ESTILO: (.*?)\]/)?.[1] || "Arte";
            textoFinal = rawTexto.replace(/\[.*?\]/g, "").trim();
        }

        return res.status(200).json({
            reply: textoFinal || "Que pergunta legal! Vamos descobrir juntos? 🎨",
            image: imagemResult,
            info: infoExtra,
            googleArtsUrl: `https://artsandculture.google.com/search?q=${encodeURIComponent(mensagem)}`
        });

    } catch (error) {
        return res.status(200).json({ reply: "Minhas tintas derramaram! 🎨" });
    }
}
