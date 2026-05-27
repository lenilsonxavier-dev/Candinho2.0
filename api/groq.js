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

// Carrega os JSONs de forma mais resiliente com timeout e cabeçalhos apropriados
async function carregarJSONs() {
    if (cacheData) return cacheData;
    const results = {};
    
    await Promise.all(Object.entries(JSON_FILES).map(async ([key, file]) => {
        try {
            const url = GITHUB_BASE + file;
            // Define um limite de 6 segundos para cada fetch para evitar que a função trave
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 6000);

            const res = await fetch(url, {
                headers: { 'Accept': 'application/json' },
                signal: controller.signal
            });
            clearTimeout(id);

            if (res.ok) {
                results[key] = await res.json();
            } else {
                console.warn(`⚠️ ${file} retornou status ${res.status}`);
            }
        } catch (err) {
            console.warn(`❌ Erro ao buscar ${file}:`, err.message);
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

// Une os arrays de frases em parágrafos contínuos e bem estruturados
function extrairTexto(campo) {
    if (!campo) return "";
    if (Array.isArray(campo)) {
        return campo
            .map(item => typeof item === "string" ? item.trim() : "")
            .filter(Boolean)
            .join(" "); // Une as frases com espaços para formar um texto fluido
    }
    return typeof campo === "string" ? campo.trim() : String(campo);
}

// Corta o texto sem quebrar palavras ou frases no meio
function limitarTextoAmigavel(texto, maxCaracteres = 400) {
    if (!texto || texto.length <= maxCaracteres) return texto;
    
    const sub = texto.substring(0, maxCaracteres);
    // Procura o último ponto final, interrogação ou exclamação antes do limite
    const ultimoPonto = Math.max(sub.lastIndexOf("."), sub.lastIndexOf("!"), sub.lastIndexOf("?"));
    
    if (ultimoPonto > 150) {
        return sub.substring(0, ultimoPonto + 1);
    }
    return sub + "...";
}

// Busca artista nos JSONs de artistas
function buscarArtista(nome, data) {
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

// Busca conceito (dança, arte, piada) nos JSONs usando o texto completo
function buscarConceito(pergunta, data) {
    const texto = normalizar(pergunta);
    
    if (texto.includes("danca") || texto.includes("dança")) {
        const dancas = data.dancas;
        if (dancas && dancas.o_que_e_danca) {
            // Puxa o texto completo em vez de dancas.o_que_e_danca.inicio[0]
            const explicacao = extrairTexto(dancas.o_que_e_danca.explicacao_infantil) || 
                              extrairTexto(dancas.o_que_e_danca.inicio);
            if (explicacao) return explicacao;
        }
        return "Dança é a arte de movimentar o corpo seguindo o ritmo da música! É um jeito muito divertido de expressar nossos sentimentos e gastar energia! 💃✨";
    }
    
    if (texto.includes("arte")) {
        const arte = data.artes_visuais;
        if (arte && arte.o_que_e_arte) {
            const explicacao = extrairTexto(arte.o_que_e_arte.explicacao_infantil) || 
                              extrairTexto(arte.o_que_e_arte.inicio);
            if (explicacao) return explicacao;
        }
        return "Arte é tudo aquilo que criamos usando a nossa imaginação, sentimentos e criatividade. Pode ser uma pintura, uma música ou até um desenho! 🎨🌟";
    }
    
    if (texto.includes("desenho")) {
        const arte = data.artes_visuais;
        if (arte && arte.o_que_e_desenho) {
            const explicacao = extrairTexto(arte.o_que_e_desenho.explicacao_infantil) || 
                              extrairTexto(arte.o_que_e_desenho.inicio);
            if (explicacao) return explicacao;
        }
        return "Desenho é uma forma de criar imagens usando linhas, pontos e formas sobre uma folha de papel! ✏️✨";
    }
    
    if (texto.includes("pintura")) {
        const arte = data.artes_visuais;
        if (arte && arte.o_que_e_pintura) {
            const explicacao = extrairTexto(arte.o_que_e_pintura.explicacao_infantil) || 
                              extrairTexto(arte.o_que_e_pintura.inicio);
            if (explicacao) return explicacao;
        }
        return "Pintura é a arte de aplicar cores em uma superfície, usando pincéis, tintas ou até os dedos para criar uma imagem linda! 🖌️🌈";
    }
    
    if (texto.includes("piada")) {
        const piadas = data.piadas;
        if (piadas) {
            const lista = Object.values(piadas);
            if (lista.length) {
                const p = lista[Math.floor(Math.random() * lista.length)];
                if (typeof p === "string") return p;
                return extrairTexto(p.explicacao_infantil) || extrairTexto(p.resposta) || extrairTexto(p.pergunta);
            }
        }
        const fallbackPiadas = [
            "Por que o quadro foi ao médico? Porque estava com uma dor na moldura! 😄",
            "O que o pincel disse para a tela? Vamos colorir esse mundo juntos! 🎨",
            "Qual é o peixe que sabe desenhar? O peixe-espada-de-cores! 🐟"
        ];
        return fallbackPiadas[Math.floor(Math.random() * fallbackPiadas.length)];
    }
    return null;
}

// Busca imagem na Europeana
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
        console.error("Erro na Europeana:", e);
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
    if (req.method !== "POST") return res.status(405).send();

    try {
        const { mensagem, memoria = {} } = req.body;
        const data = await carregarJSONs();
        let ultimoArtista = memoria.ultimoArtista || null;
        let resposta = null;
        let imagem = null;
        let novoArtista = null;

        // 1. Perguntas contextuais curtas
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

        // 2. Conceitos (dança, arte, desenho, pintura, piada)
        if (!resposta) {
            resposta = buscarConceito(mensagem, data);
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
                    
                    // Limita o tamanho de forma inteligente para não quebrar a frase
                    resposta = limitarTextoAmigavel(resposta, 380);
                    imagem = await buscarImagem(artista.nome);
                } else {
                    resposta = `Ainda não tenho informações sobre ${nome} no meu acervo de arte. 🦆✨`;
                }
            }
        }

        // 4. Saudações e ajuda
        if (!resposta) {
            const msg = mensagem.toLowerCase();
            if (msg.includes("oi") || msg.includes("olá")) {
                resposta = "Olá! Sou o Candinho, seu amigo artista. Pergunte sobre pintores famosos, dança, tipos de arte ou peça uma piada divertida! 🎨";
            } else if (msg.includes("obrigado") || msg.includes("obrigada")) {
                resposta = "Por nada! Fico muito feliz em ajudar você. Se quiser saber mais, é só chamar! 🦆💛";
            } else if (msg.includes("ajuda")) {
                resposta = "Tente me perguntar: 'Quem foi Tarsila?', 'O que é dança?', 'Conta uma piada' ou 'Qual a obra de Portinari?'";
            } else {
                resposta = "Ainda estou aprendendo sobre isso. Tente perguntar sobre um artista ou um tipo de arte diferente! 🎨✨";
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
            reply: "Puxa, minhas tintas misturaram aqui! 🎨 Pode fazer a pergunta de novo?",
            artista: null
        });
    }
}
