import { bibliotecaCultural } 
from "../src/data/bibliotecaCultural.js";

console.log("API iniciou");
console.log("biblioteca:", bibliotecaCultural);
console.log(
  "registros:",
  Object.keys(bibliotecaCultural).length
);

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
// BUSCA NA BIBLIOTECA CULTURAL (MELHORADA)
// ========================================
function buscarArtistaNaBiblioteca(nome) {
    if (!bibliotecaCultural) {
        console.error("❌ bibliotecaCultural não carregada!");
        return null;
    }
    
    const nomeNorm = normalizar(nome);
    console.log(`🔍 Buscando por: "${nomeNorm}"`);
    
    for (const [chave, info] of Object.entries(bibliotecaCultural)) {
        if (chave === "conceitos") continue;
        
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
        
        // BUSCA MAIS FLEXÍVEL
        if (
            chaveNorm.includes(nomeNorm) ||
            nomeInfo.includes(nomeNorm) ||
            palavras.some(p => p.includes(nomeNorm) || nomeNorm.includes(p))
        ) {
            console.log(`✅ Encontrado na biblioteca: ${chave}`);
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
    
    console.log(`❌ Não encontrado na biblioteca: ${nome}`);
    return null;
}

// ========================================
// BUSCA NOS JSONs (REFORÇADA E MAIS FLEXÍVEL)
// ========================================
function buscarArtistaNosJSONs(nome, data) {
    const nomeNorm = normalizar(nome);
    const fontes = ["artistas", "artistas_universais", "artistas_indigenas_afrobrasileiros", "artistas_mulheres_historicas"];
    
    console.log(`🔍 Buscando nos JSONs por: "${nomeNorm}"`);
    
    for (const fonte of fontes) {
        const conteudo = data[fonte];
        if (!conteudo) {
            console.log(`📁 Fonte ${fonte} não carregada`);
            continue;
        }
        
        console.log(`📁 Buscando em ${fonte}...`);
        
        for (const [chave, info] of Object.entries(conteudo)) {
            const chaveNorm = normalizar(chave.replace(/_/g, " "));
            const nomeInfo = normalizar(info.nome || "");
            const palavras = (info.palavras_chave || []).map(normalizar);
            
            // BUSCA MAIS FLEXÍVEL - aceita match parcial
            if (
                chaveNorm.includes(nomeNorm) ||
                nomeInfo.includes(nomeNorm) ||
                palavras.some(p => p.includes(nomeNorm) || nomeNorm.includes(p))
            ) {
                console.log(`✅ Encontrado no JSON ${fonte}: ${chave}`);
                
                // Constrói biografia mais completa combinando múltiplos campos
                let biografiaCompleta = "";
                const bioParts = [];
                
                if (info.explicacao_infantil) bioParts.push(extrairTexto(info.explicacao_infantil));
                if (info.explicacao_curta) bioParts.push(extrairTexto(info.explicacao_curta));
                if (info.inicio) bioParts.push(extrairTexto(info.inicio));
                if (info.quem_foi) bioParts.push(extrairTexto(info.quem_foi));
                if (info.descricao) bioParts.push(extrairTexto(info.descricao));
                if (info.biografia) bioParts.push(extrairTexto(info.biografia));
                
                biografiaCompleta = bioParts.join(". ") || `Informações sobre ${info.nome || chave}`;
                
                return {
                    nome: info.nome || chave.replace(/_/g, " "),
                    biografia: biografiaCompleta,
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
    // Primeiro tenta na bibliotecaCultural
    const artistaDaBiblioteca = buscarArtistaNaBiblioteca(nome);
    if (artistaDaBiblioteca) return artistaDaBiblioteca;
    
    // Depois busca nos JSONs
    return buscarArtistaNosJSONs(nome, data);
}

// ========================================
// FUNÇÃO PARA MONTAR RESPOSTA COMPLETA DO ARTISTA (3-4 LINHAS)
// ========================================
function montarRespostaArtista(artista) {
    const partes = [];
    
    // Bloco principal - biografia expandida
    if (artista.biografia && artista.biografia !== `Informações sobre ${artista.nome}`) {
        let bio = artista.biografia;
        
        // Garante que a biografia tenha conteúdo substancial
        if (bio.length < 100 && !bio.includes(". ") && !bio.includes("\n")) {
            if (artista.curiosidade && !artista.curiosidade.includes(bio)) {
                bio = `${bio} ${artista.curiosidade}`;
            }
            if (artista.obra_famosa) {
                bio = `${bio} Sua obra mais conhecida é "${artista.obra_famosa}".`;
            }
        }
        partes.push(bio);
    } else {
        // Fallback para biografia genérica mas informativa
        let bio = `${artista.nome} é um(a) artista importante.`;
        if (artista.curiosidade) bio = `${bio} ${artista.curiosidade}`;
        if (artista.obra_famosa) bio = `${bio} Sua obra mais famosa é "${artista.obra_famosa}".`;
        partes.push(bio);
    }
    
    // Adiciona curiosidade se ainda não foi incluída
    if (artista.curiosidade && !partes[0]?.includes(artista.curiosidade.substring(0, 50))) {
        partes.push(`✨ ${artista.curiosidade}`);
    }
    
    // Adiciona obra famosa se ainda não foi incluída
    if (artista.obra_famosa && !partes[0]?.includes(artista.obra_famosa) && !partes[1]?.includes(artista.obra_famosa)) {
        partes.push(`🖼️ "${artista.obra_famosa}" é uma de suas grandes obras.`);
    }
    
    // Adiciona nascimento/nacionalidade como última linha
    if (artista.nascimento) {
        partes.push(`📅 Nasceu em ${artista.nascimento}.`);
    } else if (artista.nacionalidade) {
        partes.push(`🌎 Nacionalidade: ${artista.nacionalidade}.`);
    }
    
    // Garante que tenha pelo menos 3 linhas de conteúdo
    let resposta = partes.join("\n\n");
    
    // Se ainda for muito curta (menos de 2 partes ou menos de 150 caracteres)
    if (partes.length < 2 || resposta.length < 150) {
        const complementos = [
            `${artista.nome.split(" ")[0]} é um nome importante na história da arte.`,
            `Vale a pena conhecer mais sobre este(a) artista!`,
            `Que tal pesquisar mais sobre sua trajetória?`
        ];
        
        if (partes.length === 1) {
            resposta = partes[0] + " " + complementos[0] + " " + complementos[1];
        } else if (partes.length === 0) {
            resposta = `${artista.nome} é um(a) grande artista! ${complementos[0]} ${complementos[1]}`;
        }
    }
    
    return resposta;
}

// ========================================
// BUSCA DE CONCEITOS
// ========================================
function buscarConceito(pergunta, data) {
    const texto = normalizar(pergunta);
    
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
                credito: item.dataProvider?.[0] || "Europeana",
                imagemGrande: item.edmIsShownBy?.[0] || item.edmPreview?.[0]
            };
        }
        return null;
    } catch (e) {
        console.error("Europeana error:", e);
        return null;
    }
}

function extrairNomeArtista(pergunta) {
    const texto = pergunta
        .trim()
        .replace(/[?!.,]+$/, "");

    const match = texto.match(
        /(?:quem|que)\s+(?:foi|é|e)\s+(.+)/i
    );

    if (match) {
        return match[1].trim();
    }

    if (texto.split(" ").length >= 2) {
        return texto;
    }

    return null;
}

// ========================================
// HANDLER PRINCIPAL
// ========================================
export default async function handler(req, res) {
    console.log("📚 bibliotecaCultural carregada?",
        bibliotecaCultural ? `✅ Sim (${Object.keys(bibliotecaCultural).length} itens)` : "❌ Não");
    
    if (bibliotecaCultural?.conceitos) {
        console.log("📖 Conceitos disponíveis:", Object.keys(bibliotecaCultural.conceitos));
    }
    
    if (req.method !== "POST") return res.status(405).send();

    try {
        const { mensagem, memoria = {} } = req.body;
        const data = await carregarJSONs();
        let ultimoArtista = memoria.ultimoArtista || null;
        let resposta = null;
        let imagem = null;
        let novoArtista = null;

        const curta = mensagem.toLowerCase().trim();
        
        // 1. Perguntas contextuais curtas (se há último artista)
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

        // 2. Pergunta "Quem foi?" (sem nome) - Expande sobre o último artista
        if (!resposta && ultimoArtista && (
            curta === "quem foi" ||
            curta === "quem foi?" ||
            curta === "quem é" ||
            curta === "quem é?" ||
            curta === "conte mais" ||
            curta === "fale mais" ||
            curta === "me fale mais"
        )) {
            const artista = buscarArtista(ultimoArtista, data);
            if (artista) {
                resposta = montarRespostaArtista(artista);
            }
        }

        // 3. Conceitos (dança, arte, piada)
        if (!resposta) {
            const conceito = buscarConceito(mensagem, data);
            if (conceito) resposta = conceito;
        }

        // 4. Artista (quem foi X)
        if (!resposta) {
            const nome = extrairNomeArtista(mensagem);
            if (nome) {
                const artista = buscarArtista(nome, data);
                if (artista) {
                    novoArtista = artista.nome;
                    ultimoArtista = novoArtista;
                    resposta = montarRespostaArtista(artista);
                    imagem = await buscarImagem(artista.nome);
                } else {
                    resposta = `Ainda não tenho informações sobre ${nome} no meu acervo. 🦆✨\n\nTente perguntar de outra forma ou sobre outro artista!`;
                }
            }
        }

        // 5. Saudações e ajuda
        if (!resposta) {
            const msg = mensagem.toLowerCase();
            if (msg.includes("oi") || msg.includes("olá")) {
                resposta = "Olá! Sou o Candinho, seu amigo artista. 🎨🦆\n\nPergunte sobre artistas, dança, arte ou peça uma piada! Exemplo: 'Quem foi Tarsila do Amaral?'";
            } else if (msg.includes("obrigado")) {
                resposta = "Por nada! Fico feliz em ajudar. 🦆💛\n\nContinue explorando a arte comigo!";
            } else if (msg.includes("ajuda")) {
                resposta = "🎨 **Como posso ajudar:**\n\n• 'Quem foi Tarsila do Amaral?'\n• 'O que é dança?'\n• 'Conte uma piada'\n• 'Qual a obra mais famosa de Portinari?'\n\nDepois de perguntar sobre um artista, pode dizer 'quem foi?' para eu repetir com mais detalhes!";
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
