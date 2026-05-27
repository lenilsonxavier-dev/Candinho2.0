import { bibliotecaCultural } 
from "../src/data/bibliotecaCultural.js";

console.log("API iniciou");
console.log("biblioteca:", bibliotecaCultural);
console.log("registros:", Object.keys(bibliotecaCultural).length);
console.log("Conceitos:", bibliotecaCultural?.conceitos ? Object.keys(bibliotecaCultural.conceitos) : "Nenhum");

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
            } else {
                console.warn(`⚠️ ${file} não encontrado (status: ${res.status})`);
            }
        } catch (err) {
            console.warn(`❌ Erro ao carregar ${file}:`, err.message);
        }
    }));
    cacheData = results;
    console.log("📦 JSONs carregados:", Object.keys(results).filter(k => results[k]));
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
    if (!bibliotecaCultural) {
        console.error("❌ bibliotecaCultural não carregada!");
        return null;
    }
    
    const nomeNorm = normalizar(nome);
    console.log(`🔍 Buscando na biblioteca: "${nomeNorm}"`);
    
    // Lista de nomes conhecidos para debug
    const chavesConhecidas = Object.keys(bibliotecaCultural).filter(k => k !== "conceitos");
    console.log(`📚 Biblioteca tem ${chavesConhecidas.length} artistas:`, chavesConhecidas.slice(0, 5));
    
    for (const [chave, info] of Object.entries(bibliotecaCultural)) {
        if (chave === "conceitos") continue;
        
        const chaveNorm = normalizar(chave.replace(/_/g, " "));
        const nomeInfo = normalizar(info.nome || "");
        const palavras = (info.palavras_chave || []).map(normalizar);
        
        // Busca flexível
        const matchChave = chaveNorm.includes(nomeNorm) || nomeNorm.includes(chaveNorm);
        const matchNome = nomeInfo.includes(nomeNorm) || nomeNorm.includes(nomeInfo);
        const matchPalavra = palavras.some(p => p.includes(nomeNorm) || nomeNorm.includes(p));
        
        if (matchChave || matchNome || matchPalavra) {
            console.log(`✅ Encontrado na biblioteca: ${chave}`);
            
            let biografia = "";
            if (info.explicacao_infantil) biografia = extrairTexto(info.explicacao_infantil);
            else if (info.explicacao_curta) biografia = extrairTexto(info.explicacao_curta);
            else if (info.inicio) biografia = extrairTexto(info.inicio);
            else if (info.quem_foi) biografia = extrairTexto(info.quem_foi);
            
            return {
                nome: info.nome || chave.replace(/_/g, " "),
                biografia: biografia,
                curiosidade: extrairTexto(info.curiosidade),
                obra_famosa: info.obra_mais_famosa || (info.obras?.[0]),
                nascimento: info.nascimento || info.ano_nascimento,
                nacionalidade: info.nacionalidade || "Brasileira"
            };
        }
    }
    
    console.log(`❌ Não encontrado na biblioteca: ${nome}`);
    return null;
}

// ========================================
// BUSCA NOS JSONs
// ========================================
function buscarArtistaNosJSONs(nome, data) {
    const nomeNorm = normalizar(nome);
    const fontes = ["artistas", "artistas_universais", "artistas_indigenas_afrobrasileiros", "artistas_mulheres_historicas"];
    
    console.log(`🔍 Buscando nos JSONs por: "${nomeNorm}"`);
    
    for (const fonte of fontes) {
        const conteudo = data[fonte];
        if (!conteudo) {
            console.log(`📁 Fonte ${fonte} não disponível`);
            continue;
        }
        
        console.log(`📁 Verificando ${fonte}...`);
        
        for (const [chave, info] of Object.entries(conteudo)) {
            const chaveNorm = normalizar(chave.replace(/_/g, " "));
            const nomeInfo = normalizar(info.nome || "");
            const palavras = (info.palavras_chave || []).map(normalizar);
            
            // Busca flexível
            const matchChave = chaveNorm.includes(nomeNorm) || nomeNorm.includes(chaveNorm);
            const matchNome = nomeInfo.includes(nomeNorm) || nomeNorm.includes(nomeInfo);
            const matchPalavra = palavras.some(p => p.includes(nomeNorm) || nomeNorm.includes(p));
            
            if (matchChave || matchNome || matchPalavra) {
                console.log(`✅ Encontrado no JSON ${fonte}: ${chave}`);
                
                // Monta biografia completa
                let biografia = "";
                if (info.explicacao_infantil) biografia = extrairTexto(info.explicacao_infantil);
                else if (info.explicacao_curta) biografia = extrairTexto(info.explicacao_curta);
                else if (info.inicio) biografia = extrairTexto(info.inicio);
                else if (info.quem_foi) biografia = extrairTexto(info.quem_foi);
                else if (info.descricao) biografia = extrairTexto(info.descricao);
                
                if (!biografia || biografia.length < 20) {
                    biografia = `${info.nome || chave} é um(a) artista importante na história da arte.`;
                }
                
                return {
                    nome: info.nome || chave.replace(/_/g, " "),
                    biografia: biografia,
                    curiosidade: extrairTexto(info.curiosidade),
                    obra_famosa: info.obra_mais_famosa || (info.obras?.[0]),
                    nascimento: info.nascimento || info.ano_nascimento,
                    nacionalidade: info.nacionalidade
                };
            }
        }
    }
    
    console.log(`❌ Não encontrado nos JSONs: ${nome}`);
    return null;
}

// ========================================
// FUNÇÃO PRINCIPAL DE BUSCA
// ========================================
function buscarArtista(nome, data) {
    const artistaDaBiblioteca = buscarArtistaNaBiblioteca(nome);
    if (artistaDaBiblioteca) return artistaDaBiblioteca;
    return buscarArtistaNosJSONs(nome, data);
}

// ========================================
// MONTAR RESPOSTA (3-4 LINHAS)
// ========================================
function montarRespostaArtista(artista) {
    const partes = [];
    
    // Biografia principal
    if (artista.biografia && artista.biografia.length > 10) {
        let bio = artista.biografia;
        if (!bio.endsWith(".") && !bio.endsWith("!")) bio += ".";
        partes.push(bio);
    } else {
        partes.push(`${artista.nome} é um(a) artista que marcou a história com sua arte.`);
    }
    
    // Curiosidade
    if (artista.curiosidade && artista.curiosidade.length > 5) {
        partes.push(`✨ ${artista.curiosidade}`);
    }
    
    // Obra famosa
    if (artista.obra_famosa) {
        partes.push(`🖼️ Obra conhecida: "${artista.obra_famosa}"`);
    }
    
    // Nascimento ou nacionalidade
    if (artista.nascimento) {
        partes.push(`📅 ${artista.nascimento}`);
    } else if (artista.nacionalidade) {
        partes.push(`🌎 ${artista.nacionalidade}`);
    }
    
    return partes.join("\n\n");
}

// ========================================
// EXTRAIR NOME DO ARTISTA (CORRIGIDO)
// ========================================
function extrairNomeArtista(pergunta) {
    // Remove saudações comuns
    const limpa = pergunta.trim()
        .replace(/^(oi|olá|opa|e aí|bom dia|boa tarde|boa noite)[\s,]+/i, "")
        .replace(/[\?\!\.]+$/, "");
    
    // Padrão: quem foi X / quem é X
    const match = limpa.match(/(?:quem|que)\s+(?:foi|é|e)\s+([A-Za-zÀ-ÖØ-öø-ÿ\s]+)/i);
    if (match) {
        return match[1].trim();
    }
    
    // Se for apenas um nome ou nome composto (2-3 palavras) sem "quem foi"
    const palavras = limpa.split(/\s+/);
    if (palavras.length >= 2 && palavras.length <= 4) {
        // Verifica se não é uma frase comum
        const naoArtistas = ["como você", "o que é", "qual é", "me fale", "conte uma"];
        if (!naoArtistas.some(nao => limpa.toLowerCase().includes(nao))) {
            return limpa;
        }
    }
    
    return null;
}

// ========================================
// BUSCA DE CONCEITOS
// ========================================
function buscarConceito(pergunta, data) {
    const texto = normalizar(pergunta);
    
    // Primeiro tenta na bibliotecaCultural
    const conceitos = bibliotecaCultural?.conceitos;
    if (conceitos) {
        if (texto.includes("danca") || texto.includes("dança")) {
            const danca = conceitos.danca;
            if (danca && danca.inicio) return Array.isArray(danca.inicio) ? danca.inicio[0] : danca.inicio;
            return "Dança é a arte de movimentar o corpo no ritmo da música! 💃\n\nExistem muitos tipos: balé, dança de rua, danças folclóricas e muito mais!";
        }
        if (texto.includes("arte") && !texto.includes("pintura") && !texto.includes("desenho")) {
            const arte = conceitos.arte;
            if (arte && arte.inicio) return Array.isArray(arte.inicio) ? arte.inicio[0] : arte.inicio;
            return "Arte é tudo que criamos com imaginação e sentimento! 🎨\n\nPode ser pintura, música, dança, teatro, escultura e muitas outras formas!";
        }
    }
    
    // Respostas específicas para tipos de dança
    if ((texto.includes("tipo") || texto.includes("quais")) && (texto.includes("danca") || texto.includes("dança"))) {
        return "🎭 Existem muitos tipos de dança!\n\n• Ballet clássico\n• Dança de rua (Hip Hop)\n• Samba\n• Danças folclóricas\n• Dança contemporânea\n• Forró\n• Danças indígenas\n\nQual você quer conhecer melhor?";
    }
    
    // Fallback para outros conceitos
    if (texto.includes("danca") || texto.includes("dança")) {
        return "Dança é a arte de movimentar o corpo no ritmo da música! 💃\n\nExistem muitos tipos: balé, dança de rua, danças folclóricas e muito mais!";
    }
    if (texto.includes("arte")) {
        return "Arte é tudo que criamos com imaginação e sentimento! 🎨\n\nPode ser pintura, música, dança, teatro, escultura e outras formas de expressão!";
    }
    if (texto.includes("piada")) {
        const piadas = [
            "Por que o quadro foi ao médico? Porque estava com uma moldura estranha! 😄",
            "O que o pincel disse para a tela? Vamos pintar o sete! 🎨",
            "Qual é o artista mais barato? O que só desenha com carvão! ✏️"
        ];
        return piadas[Math.floor(Math.random() * piadas.length)];
    }
    
    return null;
}

// ========================================
// BUSCA IMAGEM
// ========================================
async function buscarImagem(artistaNome) {
    if (!EUROPEANA_API_KEY || EUROPEANA_API_KEY === "SUA_CHAVE_AQUI") return null;
    try {
        const query = `"${encodeURIComponent(artistaNome)}" AND painting`;
        const url = `https://api.europeana.eu/record/v2/search.json?wskey=${EUROPEANA_API_KEY}&query=${query}&qf=TYPE:IMAGE&rows=3`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.items && data.items.length) {
            const item = data.items[0];
            return {
                imagemUrl: item.edmPreview?.[0],
                titulo: item.title?.[0] || `Obra de ${artistaNome}`,
                credito: item.dataProvider?.[0] || "Europeana"
            };
        }
        return null;
    } catch (e) {
        console.error("Europeana error:", e);
        return null;
    }
}

// ========================================
// HANDLER PRINCIPAL
// ========================================
export default async function handler(req, res) {
    console.log("📚 bibliotecaCultural:", bibliotecaCultural ? `✅ ${Object.keys(bibliotecaCultural).length} itens` : "❌");
    
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

        // 1. Saudações e conversa casual (prioridade máxima)
        const saudacoes = ["oi", "olá", "opa", "e aí", "bom dia", "boa tarde", "boa noite"];
        const ehSaudacao = saudacoes.some(s => msgLower.startsWith(s));
        
        if (ehSaudacao && !msgLower.includes("quem") && !msgLower.includes("oque")) {
            const nome = msgOriginal.replace(/^(oi|olá|opa|e aí|bom dia|boa tarde|boa noite)[\s,]+/i, "").trim();
            if (nome && nome.length > 2 && !nome.includes("candinho")) {
                resposta = `Olá, ${nome}! 🦆🎨\n\nSou o Candinho, seu amigo artista. Pergunte sobre artistas, dança ou arte!`;
            } else {
                resposta = "Olá! Sou o Candinho, seu amigo artista. 🦆🎨\n\nPergunte sobre artistas, dança, arte ou peça uma piada!";
            }
        }
        
        // 2. "Quem foi?" sem nome - usa último artista
        if (!resposta && ultimoArtista && (msgLower === "quem foi" || msgLower === "quem é" || msgLower === "conte mais" || msgLower === "fale mais")) {
            const artista = buscarArtista(ultimoArtista, data);
            if (artista) {
                resposta = montarRespostaArtista(artista);
            }
        }
        
        // 3. Conceitos (dança, arte, piada)
        if (!resposta) {
            const conceito = buscarConceito(msgOriginal, data);
            if (conceito) resposta = conceito;
        }
        
        // 4. Busca de artista
        if (!resposta) {
            const nomeArtista = extrairNomeArtista(msgOriginal);
            if (nomeArtista) {
                console.log(`🎨 Buscando artista: "${nomeArtista}"`);
                const artista = buscarArtista(nomeArtista, data);
                if (artista) {
                    novoArtista = artista.nome;
                    ultimoArtista = novoArtista;
                    resposta = montarRespostaArtista(artista);
                    imagem = await buscarImagem(artista.nome);
                    console.log(`✅ Resposta gerada para ${artista.nome}`);
                } else {
                    resposta = `Ainda não tenho informações sobre "${nomeArtista}" no meu acervo. 🦆✨\n\nTente perguntar sobre:\n• Tarsila do Amaral\n• Conceição Evaristo\n• Daiara Tukano\n• Carolina Maria de Jesus\n• Ou peça uma piada!`;
                }
            }
        }
        
        // 5. Ajuda
        if (!resposta) {
            if (msgLower.includes("ajuda")) {
                resposta = "🎨 **Como posso ajudar:**\n\n• 'Quem foi Tarsila do Amaral?'\n• 'Quem é Conceição Evaristo?'\n• 'O que é dança?'\n• 'Quais são os tipos de dança?'\n• 'Conte uma piada'\n\nDepois de perguntar sobre um artista, pode dizer 'quem foi?' para eu repetir!";
            } else {
                resposta = "Não entendi. 🦆\n\nPergunte sobre um artista (ex: 'Quem foi Conceição Evaristo?'), conceito artístico ou peça uma piada!\n\nDigite 'ajuda' para ver exemplos.";
            }
        }

        return res.status(200).json({
            reply: resposta,
            image: imagem,
            artista: novoArtista || ultimoArtista
        });

    } catch (err) {
        console.error("Erro no handler:", err);
        return res.status(200).json({
            reply: "Puxa, tive um probleminha! 🎨 Pode perguntar de novo?",
            artista: null
        });
    }
}
