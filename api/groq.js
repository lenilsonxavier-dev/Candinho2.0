// api/groq.js
import { bibliotecaCultural } from "../src/data/bibliotecaCultural.js";

const GITHUB_BASE = "https://raw.githubusercontent.com/lenilsonxavier-dev/Candinho2.0/main/data/";
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// --- FUNÇÃO AUXILIAR: BUSCA NA BIBLIOTECA JS ---
function buscarNaBiblioteca(pergunta) {
    try {
        const texto = pergunta.toLowerCase();
        for (const chave in bibliotecaCultural) {
            const item = bibliotecaCultural[chave];
            if (item.palavras_chave && item.palavras_chave.some(p => texto.includes(p.toLowerCase()))) {
                return `${item.inicio[0]} ${item.explicacao_curta[0]}`;
            }
        }
    } catch (e) { console.error("Erro na Biblioteca JS:", e); }
    return null;
}

// --- FUNÇÃO AUXILIAR: BUSCA NA WIKIMEDIA ---
async function buscarNaWikimedia(pergunta) {
    try {
        const stopWords = ["quem", "foi", "fale", "sobre", "ver", "obra"];
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
                titulo: info.extmetadata?.ObjectName?.value || "Obra de arte",
                credito: "Wikimedia Commons"
            };
        }
    } catch (e) { console.error("Erro Wikimedia:", e); }
    return null;
}

// --- HANDLER PRINCIPAL ---
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    try {
        const { mensagem } = req.body;
        if (!mensagem) return res.status(400).json({ reply: "Diga algo para mim! 🎨" });

        // 1. Busca imagem e link do Google Arts
        const [imagemResult, linkGoogleArts] = await Promise.all([
            buscarNaWikimedia(mensagem),
            Promise.resolve(`https://artsandculture.google.com/search?q=${encodeURIComponent(mensagem)}`)
        ]);

        // 2. Busca Texto (Biblioteca JS primeiro)
        let textoFinal = buscarNaBiblioteca(mensagem);

        // 3. Se não achou, pede ao Groq
        if (!textoFinal && GROQ_API_KEY) {
            try {
                const responseGroq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: "llama-3.1-8b-instant",
                        messages: [
                            { role: "system", content: "Você é o Candinho, professor de arte infantil. Diga quem foi o artista, nascimento e morte em até 3 frases. Seja fofo e use emojis 🎨." },
                            { role: "user", content: mensagem }
                        ]
                    })
                });
                const dataIA = await responseGroq.json();
                textoFinal = dataIA.choices?.[0]?.message?.content;
            } catch (e) { console.error("Erro Groq:", e); }
        }

        // 4. Resposta de segurança
        if (!textoFinal) textoFinal = "Que pergunta legal! Não encontrei nos meus livros agora, mas vamos pesquisar juntos? 🎨";

        return res.status(200).json({
            reply: textoFinal,
            image: imagemResult,
            googleArts: { url: linkGoogleArts }
        });

    } catch (error) {
        console.error("Erro Geral:", error);
        return res.status(200).json({ reply: "Tive um pequeno borrão nas minhas tintas, pode repetir? 🎨" });
    }
}
