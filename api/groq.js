// api/groq.js
import { bibliotecaCultural } from "../src/data/bibliotecaCultural.js";

const GITHUB_BASE = "https://raw.githubusercontent.com/lenilsonxavier-dev/Candinho2.0/main/data/";
const EUROPEANA_API_KEY = process.env.EUROPEANA_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Nomes EXATOS dos arquivos no seu GitHub
const JSON_FILES = {
    apoio_emocional: "apoio_emocional.json",
    arte_artista: "arte_artista.json",
    artistas_indigenas: "artistas-indigenas-afrobrasileiros.json",
    artistas_mulheres: "artistas-mulheres-historicas.json",
    artistas: "artistas.json",
    obras_famosas: "obras-famosas-mundo.json",
    obras_modernistas: "obras-modernistas-brasileiras.json",
    historia_arte: "historia_arte.json",
    folclore: "folclore.json",
    saudacoes: "saudacoes.json"
};

// ======================= BUSCA NA BIBLIOTECA CULTURAL (JS) =======================
function buscarNaBiblioteca(pergunta) {
    const texto = pergunta.toLowerCase();
    // Como a bibliotecaCultural é um objeto de objetos, iteramos pelas chaves
    for (const chave in bibliotecaCultural) {
        const item = bibliotecaCultural[chave];
        if (item.palavras_chave && item.palavras_chave.some(p => texto.includes(p.toLowerCase()))) {
            return {
                texto: `${item.inicio[0]} ${item.explicacao_curta[0]}`,
                nascimento: item.ano_nascimento,
                morte: item.ano_falecimento
            };
        }
    }
    return null;
}

// ======================= BUSCA NOS JSONs (GITHUB) =======================
async function buscarNosJSONs(pergunta) {
    const texto = pergunta.toLowerCase();
    try {
        const response = await fetch(GITHUB_BASE + "artistas.json");
        const artistas = await response.json();
        for (const nome in artistas) {
            if (texto.includes(nome.toLowerCase())) {
                return artistas[nome].explicacao_infantil || artistas[nome].descricao;
            }
        }
    } catch (e) { return null; }
    return null;
}

// ======================= BUSCA NA EUROPEANA =======================
async function buscarNaEuropeana(pergunta) {
    if (!EUROPEANA_API_KEY) return null;
    
    // Limpeza para pegar o nome do artista
    const stopWords = ["quem", "foi", "fale", "sobre", "ver", "obra", "mostre", "quando", "nasceu"];
    let palavras = pergunta.toLowerCase().replace(/[?!.,]/g, "").split(/\s+/).filter(p => p.length > 2 && !stopWords.includes(p));
    let termo = palavras.slice(0, 3).join(' ');

    if (!termo) return null;

    try {
        // Usando a lógica de busca por "who" (quem) que você enviou
        const query = `who:"${encodeURIComponent(termo)}"`;
        const url = `https://api.europeana.eu/record/v2/search.json?wskey=${EUROPEANA_API_KEY}&query=${query}&qf=TYPE:IMAGE&rows=1&profile=portal`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.items && data.items.length > 0) {
            const item = data.items[0];
            return {
                imagemUrl: item.edmPreview ? item.edmPreview[0] : null,
                titulo: item.title ? item.title[0] : "Obra de arte",
                credito: item.dataProvider ? item.dataProvider[0] : "Europeana"
            };
        }
    } catch (e) { return null; }
    return null;
}

// ======================= HANDLER PRINCIPAL =======================
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    try {
        const { mensagem } = req.body;

        // 1. Busca imagem na Europeana (sempre tenta)
        const europeana = await buscarNaEuropeana(mensagem);

        // 2. Busca Texto na Biblioteca JS
        const biblioteca = buscarNaBiblioteca(mensagem);
        
        // 3. Busca Texto nos JSONs (se não achou no JS)
        let textoFinal = biblioteca ? biblioteca.texto : await buscarNosJSONs(mensagem);

        // 4. Se não achou em lugar nenhum, usa o Groq (IA)
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
            reply: textoFinal || "Que legal! Vamos aprender mais? 🎨",
            image: europeana ? {
                imagemUrl: europeana.imagemUrl,
                titulo: europeana.titulo,
                credito: europeana.credito
            } : null
        });

    } catch (error) {
        return res.status(200).json({ reply: "Tive um probleminha, mas já estou bem! 🎨" });
    }
}
