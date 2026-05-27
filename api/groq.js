import { bibliotecaCultural } 
from "../src/data/bibliotecaCultural.js";

console.log("API iniciou");
console.log("biblioteca:", bibliotecaCultural);
console.log("registros:", Object.keys(bibliotecaCultural).length);

// ========================================
// CONFIGURAÇÃO
// ========================================
const GITHUB_BASE = "https://raw.githubusercontent.com/lenilsonxavier-dev/Candinho2.0/main/data/";
const EUROPEANA_API_KEY = process.env.EUROPEANA_API_KEY;

const JSON_FILES = {
    artistas: "artistas.json",
    artistas_universais: "artistas_universais.json",
    artistas_indigenas_afrobrasileiros: "artistas-indigenas-afrobrasileiros.json",
    artistas_mulheres_historicas: "artistas-mulheres-historicas.json",
    dancas: "dancas.json",
    artes_visuais: "artes_visuais.json",
    piadas: "piadas.json",
    curiosidades: "curiosidades.json",
    musica: "musica.json",
    teatro: "teatro.json",
    folclore: "folclore.json",
    cultura_afro_brasileira: "cultura_afro_brasileira.json",
    cultura_indigena: "cultura_indigena.json",
    cantigas_de_roda: "cantigas_de_roda.json",
    literatura_conceitos: "literatura_conceitos.json"
};

let cacheData = null;

// ========================================
// FUNÇÕES AUXILIARES
// ========================================
async function carregarJSONs() {
    if (cacheData) return cacheData;
    const results = {};
    await Promise.all(Object.entries(JSON_FILES).map(async ([key, file]) => {
        try {
            const res = await fetch(GITHUB_BASE + file);
            if (res.ok) {
                results[key] = await res.json();
                console.log(`✅ Carregado: ${file}`);
            }
        } catch (err) {
            console.warn(`❌ Erro: ${file}`);
        }
    }));
    cacheData = results;
    return results;
}

function normalizar(str) {
    if (!str) return "";
    return str.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, "").trim();
}

function extrairTexto(campo) {
    if (!campo) return "";
    if (Array.isArray(campo)) return campo.join(" ");
    if (typeof campo === "string") return campo;
    return "";
}

// ========================================
// BUSCA NA BIBLIOTECA CULTURAL
// ========================================
function buscarArtistaNaBiblioteca(nome) {
    if (!bibliotecaCultural) return null;
    
    const nomeNorm = normalizar(nome);
    console.log(`🔍 Buscando "${nomeNorm}" na biblioteca...`);
    
    for (const [chave, info] of Object.entries(bibliotecaCultural)) {
        if (chave === "conceitos") continue;
        
        const chaveNorm = normalizar(chave.replace(/_/g, " "));
        const nomeInfo = normalizar(info.nome || "");
        const palavras = (info.palavras_chave || []).map(normalizar);
        
        if (chaveNorm === nomeNorm || nomeInfo === nomeNorm || palavras.includes(nomeNorm)) {
            console.log(`✅ Encontrado: ${chave}`);
            return {
                nome: info.nome || chave.replace(/_/g, " "),
                biografia: extrairTexto(info.explicacao_infantil) ||
                           extrairTexto(info.explicacao_curta) ||
                           extrairTexto(info.inicio) ||
                           extrairTexto(info.quem_foi),
                curiosidade: extrairTexto(info.curiosidade),
                obra_famosa: info.obra_mais_famosa || (info.obras?.[0]),
                nascimento: info.nascimento || info.ano_nascimento,
                nacionalidade: info.nacionalidade || "Brasileira"
            };
        }
    }
    return null;
}

// ========================================
// BUSCA NOS JSONs COM MATCH EXATO PRIMEIRO
// ========================================
function buscarArtistaNosJSONs(nome, data) {
    const nomeNorm = normalizar(nome);
    const fontes = ["artistas", "artistas_universais", "artistas_indigenas_afrobrasileiros", "artistas_mulheres_historicas"];
    
    console.log(`🔍 Buscando "${nomeNorm}" nos JSONs...`);
    
    for (const fonte of fontes) {
        const conteudo = data[fonte];
        if (!conteudo) continue;
        
        for (const [chave, info] of Object.entries(conteudo)) {
            const chaveNorm = normalizar(chave.replace(/_/g, " "));
            const nomeInfo = normalizar(info.nome || "");
            const palavras = (info.palavras_chave || []).map(normalizar);
            
            // Match exato primeiro
            if (nomeNorm === chaveNorm || nomeNorm === nomeInfo || palavras.includes(nomeNorm)) {
                console.log(`✅ Encontrado em ${fonte}: ${chave}`);
                return {
                    nome: info.nome || chave.replace(/_/g, " "),
                    biografia: extrairTexto(info.explicacao_infantil) ||
                               extrairTexto(info.explicacao_curta) ||
                               extrairTexto(info.inicio) ||
                               extrairTexto(info.quem_foi),
                    curiosidade: extrairTexto(info.curiosidade),
                    obra_famosa: info.obra_mais_famosa || (info.obras?.[0]),
                    nascimento: info.nascimento || info.ano_nascimento,
                    nacionalidade: info.nacionalidade
                };
            }
        }
    }
    return null;
}

function buscarArtista(nome, data) {
    const artista = buscarArtistaNaBiblioteca(nome);
    if (artista) return artista;
    return buscarArtistaNosJSONs(nome, data);
}

// ========================================
// MONTAR RESPOSTA (3-4 LINHAS)
// ========================================
function montarRespostaArtista(artista) {
    const partes = [];
    
    if (artista.biografia && artista.biografia.length > 10) {
        partes.push(artista.biografia);
    } else {
        partes.push(`${artista.nome} é um(a) artista importante na cultura brasileira.`);
    }
    
    if (artista.curiosidade) {
        partes.push(`✨ ${artista.curiosidade}`);
    }
    
    if (artista.obra_famosa) {
        partes.push(`🖼️ Obra: "${artista.obra_famosa}"`);
    }
    
    if (artista.nascimento) {
        partes.push(`📅 ${artista.nascimento}`);
    } else if (artista.nacionalidade && artista.nacionalidade !== "Brasileira") {
        partes.push(`🌎 ${artista.nacionalidade}`);
    }
    
    return partes.join("\n\n");
}

// ========================================
// EXTRAIR NOME DO ARTISTA (CORRIGIDO)
// ========================================
function extrairNomeArtista(pergunta) {
    // Remove pontuação final
    let texto = pergunta.trim().replace(/[?¿!¡]+$/, "");
    
    // Padrão: quem foi X / quem é X
    let match = texto.match(/quem\s+(?:foi|é|e)\s+(.+)$/i);
    if (match) {
        return match[1].trim();
    }
    
    // Padrão: quem X (sem foi/é)
    match = texto.match(/quem\s+(.+)$/i);
    if (match && !match[1].toLowerCase().includes("quem")) {
        return match[1].trim();
    }
    
    // Se for apenas um nome (2-3 palavras) sem "quem"
    const palavras = texto.split(/\s+/);
    if (palavras.length >= 2 && palavras.length <= 4) {
        // Verifica se não é pergunta sobre conceito
        const conceitos = ["dança", "arte", "piada", "música", "teatro"];
        if (!conceitos.some(c => texto.toLowerCase().includes(c))) {
            return texto;
        }
    }
    
    return null;
}

// ========================================
// VERIFICAR SE É PERGUNTA SOBRE NOVO ARTISTA
// ========================================
function isPerguntaSobreNovoArtista(mensagem) {
    const msg = mensagem.toLowerCase();
    return msg.includes("quem foi") || 
           msg.includes("quem é") || 
           msg.includes("quem e") ||
           (msg.match(/^[a-zà-ú\s]{2,30}$/i) && !msg.includes("dança") && !msg.includes("arte"));
}

// ========================================
// CONCEITOS
// ========================================
function buscarConceito(pergunta) {
    const texto = normalizar(pergunta);
    
    if (texto.includes("danca") || texto.includes("dança")) {
        if (texto.includes("tipo") || texto.includes("quais")) {
            return "🎭 Tipos de dança:\n\n• Ballet clássico\n• Dança de rua (Hip Hop)\n• Samba\n• Danças folclóricas\n• Dança contemporânea\n• Forró\n• Danças indígenas\n\nQual você quer conhecer melhor?";
        }
        return "Dança é a arte de movimentar o corpo no ritmo da música! 💃\n\nExistem muitos tipos como balé, dança de rua, samba e danças folclóricas.";
    }
    
    if (texto.includes("arte") && !texto.includes("pintura")) {
        return "Arte é tudo que criamos com imaginação e sentimento! 🎨\n\nPode ser pintura, música, dança, teatro, escultura, fotografia e muitas outras formas!";
    }
    
    if (texto.includes("piada")) {
        const piadas = [
            "Por que o quadro foi ao médico? Porque estava com uma moldura estranha! 😄",
            "O que o pincel disse para a tela? Vamos pintar o sete! 🎨",
            "Qual é o artista mais barato? O que só desenha com carvão! ✏️",
            "Por que a artista foi presa? Porque ela fez um desenho de fuga! 🎭"
        ];
        return piadas[Math.floor(Math.random() * piadas.length)];
    }
    
    return null;
}

// ========================================
// SAUDAÇÕES
// ========================================
function processarSaudacao(mensagem) {
    const msg = mensagem.toLowerCase().trim();
    const saudacoes = ["oi", "olá", "opa", "e aí", "bom dia", "boa tarde", "boa noite", "hello", "hey"];
    
    const ehSaudacao = saudacoes.some(s => msg.startsWith(s) || msg === s);
    
    if (ehSaudacao) {
        // Tenta extrair nome: "Olá, eu sou Leno" ou "Oi, meu nome é Leno"
        let nome = null;
        
        const padroes = [
            /(?:eu sou|meu nome é|me chamo|sou)\s+([A-Za-zÀ-ÖØ-öø-ÿ]+)/i,
            /(?:olá|oi|opa)\s*[,:]\s*([A-Za-zÀ-ÖØ-öø-ÿ]+)/i,
            /^(?:olá|oi|opa)\s+([A-Za-zÀ-ÖØ-öø-ÿ]+)/i
        ];
        
        for (const padrao of padroes) {
            const match = mensagem.match(padrao);
            if (match) {
                nome = match[1];
                break;
            }
        }
        
        if (nome && nome.length >= 2 && nome.toLowerCase() !== "candinho") {
            return `Olá, ${nome}! 🦆🎨\n\nSou o Candinho, seu amigo artista. Pergunte sobre artistas, dança ou arte!`;
        }
        
        return "Olá! Sou o Candinho, seu amigo artista. 🦆🎨\n\nPergunte sobre artistas, dança, arte ou peça uma piada!";
    }
    
    return null;
}

// ========================================
// HANDLER PRINCIPAL
// ========================================
export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).send();

    try {
        const { mensagem, memoria = {} } = req.body;
        const data = await carregarJSONs();
        
        let ultimoArtista = memoria.ultimoArtista || null;
        let resposta = null;
        let imagem = null;
        let novoArtista = null;

        const msgOriginal = mensagem.trim();
        const msgLower = msgOriginal.toLowerCase();
        
        console.log(`📨 Mensagem: "${msgOriginal}"`);
        console.log(`📝 Último artista: ${ultimoArtista || "nenhum"}`);

        // 1. SAUDAÇÕES (prioridade máxima)
        resposta = processarSaudacao(msgOriginal);
        
        // 2. PERGUNTA SOBRE NOVO ARTISTA (reseta o contexto)
        if (!resposta && isPerguntaSobreNovoArtista(msgOriginal)) {
            const nomeArtista = extrairNomeArtista(msgOriginal);
            if (nomeArtista) {
                console.log(`🎨 Buscando NOVO artista: "${nomeArtista}"`);
                const artista = buscarArtista(nomeArtista, data);
                if (artista) {
                    novoArtista = artista.nome;
                    ultimoArtista = novoArtista;
                    resposta = montarRespostaArtista(artista);
                    imagem = await buscarImagem(artista.nome);
                    console.log(`✅ Resposta para ${artista.nome}`);
                } else {
                    resposta = `Ainda não tenho informações sobre "${nomeArtista}" no meu acervo. 🦆✨\n\nArtistas que conheço:\n• Tarsila do Amaral\n• Conceição Evaristo\n• Daiara Tukano\n• Carolina Maria de Jesus\n• Jaider Esbell\n• Portinari`;
                }
            }
        }
        
        // 3. "CONTE MAIS" sobre o último artista
        if (!resposta && ultimoArtista && (msgLower === "conte mais" || msgLower === "fale mais" || msgLower === "me fale mais")) {
            const artista = buscarArtista(ultimoArtista, data);
            if (artista) {
                resposta = montarRespostaArtista(artista);
            }
        }
        
        // 4. CONCEITOS
        if (!resposta) {
            const conceito = buscarConceito(msgOriginal);
            if (conceito) resposta = conceito;
        }
        
        // 5. OBRIGADO
        if (!resposta && msgLower.includes("obrigado")) {
            resposta = "Por nada! Fico feliz em ajudar. 🦆💛\n\nContinue explorando a arte comigo!";
        }
        
        // 6. AJUDA
        if (!resposta && msgLower.includes("ajuda")) {
            resposta = "🎨 **Como posso ajudar:**\n\n• 'Quem foi Tarsila do Amaral?'\n• 'Quem é Conceição Evaristo?'\n• 'Quem foi Carolina Maria de Jesus?'\n• 'Quem é Daiara Tukano?'\n• 'O que é dança?'\n• 'Quais são os tipos de dança?'\n• 'Conte uma piada'\n\nDepois de perguntar sobre um artista, diga 'conte mais' para saber mais detalhes!";
        }
        
        // 7. FALLBACK
        if (!resposta) {
            resposta = "Não entendi. 🦆\n\nPergunte sobre um artista (ex: 'Quem foi Conceição Evaristo?'), conceito artístico ou peça uma piada!\n\nDigite 'ajuda' para ver exemplos.";
        }

        return res.status(200).json({
            reply: resposta,
            image: imagem,
            artista: novoArtista || ultimoArtista
        });

    } catch (err) {
        console.error("Erro:", err);
        return res.status(200).json({
            reply: "Puxa, tive um probleminha! 🎨 Pode perguntar de novo?",
            artista: null
        });
    }
}

async function buscarImagem(artistaNome) {
    if (!EUROPEANA_API_KEY || EUROPEANA_API_KEY === "SUA_CHAVE_AQUI") return null;
    try {
        const url = `https://api.europeana.eu/record/v2/search.json?wskey=${EUROPEANA_API_KEY}&query=${encodeURIComponent(artistaNome)}&rows=1`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.items && data.items[0]?.edmPreview?.[0]) {
            return { imagemUrl: data.items[0].edmPreview[0] };
        }
        return null;
    } catch (e) {
        return null;
    }
}
