// ========================================
// IMPORTAÇÃO DA BIBLIOTECA CULTURAL
// ========================================
import { bibliotecaCultural } from "../../src/data/bibliotecaCultural.js";

// ========================================
// CONFIGURAÇÃO
// ========================================
const GITHUB_BASE = "https://raw.githubusercontent.com/lenilsonxavier-dev/Candinho2.0/main/data/";
const EUROPEANA_API_KEY = process.env.EUROPEANA_API_KEY;

// Lista de arquivos JSON que existem no seu repositório (fallback)
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
            if (res.ok) results[key] = await res.json();
            else console.warn(`⚠️ ${file} não encontrado`);
        } catch (err) {
            console.warn(`❌ Erro ao carregar ${file}:`, err.message);
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
    return Array.isArray(campo) ? campo.join(" ") : campo;
}

// ========================================
// BUSCA NA BIBLIOTECA CULTURAL (ACHATADA)
// ========================================
function buscarArtistaNaBiblioteca(nome) {
    if (!bibliotecaCultural) {
        console.error("❌ bibliotecaCultural não carregada!");
        return null;
    }
    
    const nomeNorm = normalizar(nome);
    console.log(`🔍 Buscando por: "${nomeNorm}"`);
    
    for (const [chave, info] of Object.entries(bibliotecaCultural)) {
        // Pula a seção de conceitos
        if (chave === "conceitos") continue;
        
        // Verifica se é uma entrada válida de artista/escritor
        // (tem palavras_chave ou tem os campos esperados)
        const isArtistaEntry = info && (
            info.palavras_chave || 
            info.inicio || 
            info.explicacao_curta ||
            info.categoria
        );
        
        if (!isArtistaEntry) continue;
        
        const chaveNorm = normalizar(chave.replace(/_/g, " "));
        const palavras = (info.palavras_chave || []).map(normalizar);
        const nomeInfo = normalizar(info.nome || "");
        
        if (nomeNorm === chaveNorm || nomeNorm === nomeInfo || palavras.includes(nomeNorm)) {
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
    
    console.log(`❌ Não encontrado: ${nome}`);
    return null;
}

// ========================================
// BUSCA NOS JSONs (FALLBACK)
// ========================================
function buscarArtistaNosJSONs(nome, data) {
    const nomeNorm = normalizar(nome);
    const fontes = ["artistas", "artistas_universais", "artistas_indigenas_afrobrasileiros", "artistas_mulheres_historicas"];
    
    for (const fonte of fontes) {
        const conteudo = data[fonte];
        if (!conteudo) continue;
        
        for (const [chave, info] of Object.entries(conteudo)) {
            const chaveNorm = normalizar(chave.replace(/_/g, " "));
            const nomeInfo = normalizar(info.nome || "");
            const palavras = (info.palavras_chave || []).map(normalizar);
            
            if (nomeNorm === chaveNorm || nomeNorm === nomeInfo || palavras.includes(nomeNorm)) {
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

// ========================================
// FUNÇÃO PRINCIPAL DE BUSCA
// ========================================
function buscarArtista(nome, data) {
    // Primeiro tenta na bibliotecaCultural
    const artistaDaBiblioteca = buscarArtistaNaBiblioteca(nome);
    if (artistaDaBiblioteca) return artistaDaBiblioteca;
    
    // Se não encontrar, tenta nos JSONs (fallback)
    return buscarArtistaNosJSONs(nome, data);
}

// ========================================
// BUSCA DE CONCEITOS
// ========================================
function buscarConceito(pergunta, data) {
    const texto = normalizar(pergunta);
    
    // PRIORIDADE: busca na bibliotecaCultural
    const conceitos = bibliotecaCultural?.conceitos;
    if (conceitos) {
        if (texto.includes("danca") || texto.includes("dança")) {
            if (conceitos.danca?.inicio) return conceitos.danca.inicio[0];
            return "Dança é a arte de movimentar o corpo no ritmo da música! 💃";
        }
        if (texto.includes("arte") && !texto.includes("pintura") && !texto.includes("desenho")) {
            if (conceitos.arte?.inicio) return conceitos.arte.inicio[0];
            return "Arte é tudo que criamos com imaginação e sentimento! 🎨";
        }
        if (texto.includes("desenho")) {
            if (conceitos.desenho?.inicio) return conceitos.desenho.inicio[0];
            return "Desenho é uma forma de arte usando linhas e formas no papel. ✏️";
        }
        if (texto.includes("pintura")) {
            if (conceitos.pintura?.inicio) return conceitos.pintura.inicio[0];
            return "Pintura é aplicar tintas numa superfície para criar imagens. 🖌️";
        }
        if (texto.includes("piada")) {
            if (conceitos.piadas && conceitos.piadas.length) {
                return conceitos.piadas[Math.floor(Math.random() * conceitos.piadas.length)];
            }
        }
    }
    
    // FALLBACK: busca nos JSONs
    if (texto.includes("danca") || texto.includes("dança")) {
        const dancas = data.dancas;
        if (dancas && dancas.o_que_e_danca?.inicio) return dancas.o_que_e_danca.inicio[0];
        return "Dança é a arte de movimentar o corpo no ritmo da música! 💃";
    }
    if (texto.includes("arte")) {
        const arte = data.artes_visuais;
        if (arte && arte.o_que_e_arte?.inicio) return arte.o_que_e_arte.inicio[0];
        return "Arte é tudo que criamos com imaginação e sentimento! 🎨";
    }
    if (texto.includes("desenho")) {
        const arte = data.artes_visuais;
        if (arte && arte.o_que_e_desenho?.inicio) return arte.o_que_e_desenho.inicio[0];
        return "Desenho é uma forma de arte usando linhas e formas no papel. ✏️";
    }
    if (texto.includes("pintura")) {
        const arte = data.artes_visuais;
        if (arte && arte.o_que_e_pintura?.inicio) return arte.o_que_e_pintura.inicio[0];
        return "Pintura é aplicar tintas numa superfície para criar imagens. 🖌️";
    }
    if (texto.includes("piada")) {
        const piadas = data.piadas;
        if (piadas) {
            const lista = Object.values(piadas);
            if (lista.length) {
                const p = lista[Math.floor(Math.random() * lista.length)];
                if (typeof p === "string") return p;
                return p.explicacao_infantil || p.resposta;
            }
        }
        const fallbackPiadas = [
            "Por que o quadro foi ao médico? Porque estava com uma moldura estranha! 😄",
            "O que o pincel disse para a tela? Vamos pintar o sete! 🎨",
            "Qual é o artista mais barato? O que só desenha com carvão! ✏️"
        ];
        return fallbackPiadas[Math.floor(Math.random() * fallbackPiadas.length)];
    }
    return null;
}

// ========================================
// BUSCA IMAGEM NA EUROPEANA
// ========================================
async function buscarImagem(artistaNome) {
    if (!EUROPEANA_API_KEY || EUROPEANA_API_KEY === "SUA_CHAVE_AQUI") return null;
    try {
        const query = `"${encodeURIComponent(artistaNome)}" AND painting`;
        const url = `https://api.europeana.eu/record/v2/search.json?wskey=${EUROPEANA_API_KEY}&query=${query}&qf=TYPE:IMAGE&rows=3`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.items && data.items.length) {
            const item = data.items.find(i => i.title?.[0]?.toLowerCase().includes(artistaNome.toLowerCase())) || data.items[0];
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

function extrairNomeArtista(pergunta) {
    const match = pergunta.match(/quem (foi|é)\s+([A-Za-zÀ-ÖØ-öø-ÿ\s]+)/i);
    return match ? match[2].trim().replace(/[?!.,]+$/, '') : null;
}

// ========================================
// HANDLER PRINCIPAL
// ========================================
export default async function handler(req, res) {
    // Log para debug
    console.log("📚 bibliotecaCultural carregada?",
        bibliotecaCultural ? `✅ Sim (${Object.keys(bibliotecaCultural).length} itens)` : "❌ Não");
    
    if (bibliotecaCultural?.conceitos) {
        console.log("📖 Conceitos disponíveis:", Object.keys(bibliotecaCultural.conceitos));
    }
    
    if (req.method !== "POST") return res.status(405).send();

    try {
        const { mensagem, memoria = {} } = req.body;
        const data = await carregarJSONs(); // ainda carrega para fallback
        let ultimoArtista = memoria.ultimoArtista || null;
        let resposta = null;
        let imagem = null;
        let novoArtista = null;

        // 1. Perguntas contextuais curtas (se há último artista)
        const curta = mensagem.toLowerCase().trim();
        if (ultimoArtista && (curta === "país" || curta === "nacionalidade" || curta.includes("nasceu") || curta.includes("ano") || curta.includes("obra"))) {
            const artista = buscarArtista(ultimoArtista, data);
            if (artista) {
                if (curta.includes("país") || curta.includes("nacionalidade")) {
                    resposta = artista.nacionalidade ? `${artista.nome} era de ${artista.nacionalidade}.` : `Não sei a nacionalidade de ${artista.nome}.`;
                } else if (curta.includes("nasceu") || curta.includes("ano")) {
                    resposta = artista.nascimento ? `${artista.nome} nasceu em ${artista.nascimento}.` : `Não tenho a data de nascimento de ${artista.nome}.`;
                } else if (curta.includes("obra")) {
                    resposta = artista.obra_famosa ? `A obra mais famosa de ${artista.nome} é "${artista.obra_famosa}".` : `${artista.nome} criou muitas obras lindas!`;
                }
            }
        }

        // 2. Conceitos (dança, arte, piada)
        if (!resposta) {
            const conceito = buscarConceito(mensagem, data);
            if (conceito) resposta = conceito;
        }

        // 3. Artista (quem foi X)
        if (!resposta) {
            const nome = extrairNomeArtista(mensagem);
            if (nome) {
                const artista = buscarArtista(nome, data);
                if (artista) {
                    novoArtista = artista.nome;
                    ultimoArtista = novoArtista;
                    resposta = artista.biografia || artista.curiosidade || `Conheça ${artista.nome}!`;
                    if (resposta.length > 350) resposta = resposta.substring(0, 350) + "...";
                    imagem = await buscarImagem(artista.nome);
                } else {
                    resposta = `Ainda não tenho informações sobre ${nome} no meu acervo. 🦆✨`;
                }
            }
        }

        // 4. Saudações e ajuda
        if (!resposta) {
            const msg = mensagem.toLowerCase();
            if (msg.includes("oi") || msg.includes("olá")) {
                resposta = "Olá! Sou o Candinho, seu amigo artista. Pergunte sobre artistas, dança, arte ou peça uma piada! 🎨";
            } else if (msg.includes("obrigado")) {
                resposta = "Por nada! Fico feliz em ajudar. 🦆💛";
            } else if (msg.includes("ajuda")) {
                resposta = "Tente: 'Quem foi Tarsila?', 'O que é dança?', 'Conte uma piada' ou 'Qual a obra mais famosa de Portinari?'";
            } else {
                resposta = "Não entendi. Pergunte sobre um artista, conceito artístico ou peça uma piada! 🎨";
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
