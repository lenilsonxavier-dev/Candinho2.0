// ========================================
// CONFIGURAÇÃO
// ========================================
const GITHUB_BASE = "https://raw.githubusercontent.com/lenilsonxavier-dev/Candinho2.0/main/data/";
const EUROPEANA_API_KEY = process.env.EUROPEANA_API_KEY;

// Todos os 30 arquivos JSON mapeados diretamente do seu repositório do GitHub
const JSON_FILES = {
    // Apoio e Atividades
    apoio_emocional: "apoio_emocional.json",
    atividades_artisticas: "atividades_artisticas.json",
    imaginacao_infantil: "imaginacao_infantil.json",
    saudacoes: "saudacoes.json",

    // Arte, Obras e Conceitos
    arte_artista: "arte_artista.json",
    arte_tecnicas: "arte_tecnicas.json",
    artes_visuais: "artes_visuais.json",
    historia_arte: "historia_arte.json",
    lugares_arte: "lugares_arte.json",
    obras_famosas_mundo: "obras-famosas-mundo.json",
    obras_modernistas_brasileiras: "obras-modernistas-brasileiras.json",

    // Artistas e Escritores (Bancos de dados de personalidades)
    artistas: "artistas.json",
    artistas_universais: "artistas_universais.json",
    artistas_indigenas_afrobrasileiros: "artistas-indigenas-afrobrasileiros.json",
    artistas_mulheres_historicas: "artistas-mulheres-historicas.json",
    escritoras_negras_indigenas_brasileiras: "escritoras-negras-indigenas-brasileiras.json",
    escritores_negros_indigenas_brasileiros: "escritores-negros-indigenas-brasileiros.json",

    // Outras áreas culturais
    dancas: "dancas.json",
    piadas: "piadas.json",
    curiosidades: "curiosidades.json",
    musica: "musica.json",
    teatro: "teatro.json",
    folclore: "folclore.json",
    cultura_afro_brasileira: "cultura_afro_brasileira.json",
    cultura_indigena: "cultura_indigena.json",
    cantigas_de_roda: "cantigas_de_roda.json",
    literatura_conceitos: "literatura_conceitos.json",
    festas_brasileiras: "festas_brasileiras.json",
    personagens_fantasticos: "personagens_fantasticos.json",
    ritmos_musicais: "ritmos_musicais.json"
};

let cacheData = null;

// ========================================
// FUNÇÕES AUXILIARES DE CARREGAMENTO
// ========================================

async function fetchComFallback(file) {
    const fetchUrl = async (fileName) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        try {
            const res = await fetch(GITHUB_BASE + fileName, { 
                headers: { 'Accept': 'application/json' },
                signal: controller.signal 
            });
            clearTimeout(timeoutId);
            if (res.ok) return await res.json();
        } catch (e) {
            clearTimeout(timeoutId);
        }
        return null;
    };

    // Tenta carregar com o nome original fornecido
    let data = await fetchUrl(file);
    if (data) return data;

    // Caso o GitHub responda com 404 devido à diferença de hífens/sublinhados
    let nomeAlternativo = "";
    if (file.includes("_")) {
        nomeAlternativo = file.replace(/_/g, "-");
    } else if (file.includes("-")) {
        nomeAlternativo = file.replace(/-/g, "_");
    }

    if (nomeAlternativo) {
        data = await fetchUrl(nomeAlternativo);
        if (data) {
            console.log(`🔄 Ajuste de arquivo automático: ${file} -> ${nomeAlternativo}`);
            return data;
        }
    }

    console.warn(`⚠️ Não foi possível encontrar o arquivo: ${file}`);
    return null;
}

async function carregarJSONs() {
    if (cacheData) return cacheData;
    const results = {};
    
    const promessas = Object.entries(JSON_FILES).map(async ([key, file]) => {
        const data = await fetchComFallback(file);
        if (data) results[key] = data;
    });

    await Promise.all(promessas);
    cacheData = results;
    return results;
}

// ========================================
// NORMALIZAÇÃO E BUSCA FLEXÍVEL
// ========================================

function normalizar(str) {
    if (!str) return "";
    return str.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, "").trim();
}

// Faz a busca flexível (permite encontrar "Pierre-Auguste Renoir" digitando apenas "Renoir")
function compararNomes(pesquisa, alvo) {
    if (!pesquisa || !alvo) return false;
    const p = normalizar(pesquisa);
    const a = normalizar(alvo);
    if (p === a) return true;
    
    // Evita falsos-positivos com termos muito curtos (exige ao menos 4 letras)
    if (p.length >= 4 && (a.includes(p) || p.includes(a))) {
        return true;
    }
    return false;
}

function extrairTexto(campo) {
    if (!campo) return "";
    if (Array.isArray(campo)) {
        return campo
            .map(item => typeof item === "string" ? item.trim() : "")
            .filter(Boolean)
            .join(" "); // Une as linhas em parágrafos para uma leitura contínua e rica
    }
    return typeof campo === "string" ? campo.trim() : String(campo);
}

function limitarTextoAmigavel(texto, maxCaracteres = 380) {
    if (!texto || texto.length <= maxCaracteres) return texto;
    const sub = texto.substring(0, maxCaracteres);
    const ultimoPonto = Math.max(sub.lastIndexOf("."), sub.lastIndexOf("!"), sub.lastIndexOf("?"));
    if (ultimoPonto > 150) {
        return sub.substring(0, ultimoPonto + 1);
    }
    return sub + "...";
}

// Busca personalidades (artistas e escritores) nos respectivos JSONs carregados
function buscarArtista(nome, data) {
    // Adicionamos os arquivos de escritores no escopo de buscas de personalidades
    const fontes = [
        "artistas", 
        "artistas_universais", 
        "artistas_indigenas_afrobrasileiros", 
        "artistas_mulheres_historicas",
        "escritoras_negras_indigenas_brasileiras",
        "escritores_negros_indigenas_brasileiros"
    ];
    
    for (const fonte of fontes) {
        const conteudo = data[fonte];
        if (!conteudo) continue;
        
        // Garante suporte tanto a objetos de chaves quanto a listas (Arrays)
        const entradas = Array.isArray(conteudo)
            ? conteudo.map((item, index) => [String(index), item])
            : Object.entries(conteudo);

        for (const [chave, info] of entradas) {
            if (!info) continue;
            
            const chaveLimpa = chave.replace(/_/g, " ");
            const nomeInfo = info.nome || "";
            const palavras = (info.palavras_chave || []).map(normalizar);
            
            const encontrou = compararNomes(nome, chaveLimpa) || 
                              compararNomes(nome, nomeInfo) || 
                              palavras.some(p => compararNomes(nome, p));
                              
            if (encontrou) {
                return {
                    nome: info.nome || chaveLimpa,
                    biografia: extrairTexto(info.explicacao_infantil) ||
                               extrairTexto(info.explicacao_curta) ||
                               extrairTexto(info.inicio) ||
                               extrairTexto(info.quem_foi) ||
                               extrairTexto(info.biografia),
                    curiosidade: extrairTexto(info.curiosidade),
                    obra_famosa: info.obra_mais_famosa || (info.obras?.[0]) || info.livro_famoso || info.obra_destaque,
                    nascimento: info.nascimento || info.ano_nascimento,
                    nacionalidade: info.nacionalidade
                };
            }
        }
    }
    return null;
}

function buscarConceito(pergunta, data) {
    const texto = normalizar(pergunta);
    
    if (texto.includes("danca") || texto.includes("dança")) {
        const dancas = data.dancas;
        if (dancas && dancas.o_que_e_danca) {
            const explicacao = extrairTexto(dancas.o_que_e_danca.explicacao_infantil) || 
                              extrairTexto(dancas.o_que_e_danca.inicio);
            if (explicacao) return explicacao;
        }
        return "Dança é a arte de movimentar o corpo seguindo o ritmo da música! É uma forma maravilhosa de se expressar! 💃✨";
    }
    
    if (texto.includes("arte")) {
        const arte = data.artes_visuais;
        if (arte && arte.o_que_e_arte) {
            const explicacao = extrairTexto(arte.o_que_e_arte.explicacao_infantil) || 
                              extrairTexto(arte.o_que_e_arte.inicio);
            if (explicacao) return explicacao;
        }
        return "Arte é tudo aquilo que criamos usando a nossa imaginação, sentimentos e criatividade! 🎨🌟";
    }
    
    if (texto.includes("desenho")) {
        const arte = data.artes_visuais;
        if (arte && arte.o_que_e_desenho) {
            const explicacao = extrairTexto(arte.o_que_e_desenho.explicacao_infantil) || 
                              extrairTexto(arte.o_que_e_desenho.inicio);
            if (explicacao) return explicacao;
        }
        return "Desenho é criar formas, linhas e caminhos em um papel para mostrar o que nossa imaginação está pensando! ✏️✨";
    }
    
    if (texto.includes("pintura")) {
        const arte = data.artes_visuais;
        if (arte && arte.o_que_e_pintura) {
            const explicacao = extrairTexto(arte.o_que_e_pintura.explicacao_infantil) || 
                              extrairTexto(arte.o_que_e_pintura.inicio);
            if (explicacao) return explicacao;
        }
        return "Pintura é a arte de aplicar cores em uma superfície usando tintas, pincéis ou até mesmo os dedos! 🖌️🌈";
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
        return "Por que o pincel foi ao médico? Porque estava com uma dor na moldura! 😄🎨";
    }
    return null;
}

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

        // 2. Conceitos
        if (!resposta) {
            resposta = buscarConceito(mensagem, data);
        }

        // 3. Artista ou Escritor (Quem foi X)
        if (!resposta) {
            const nome = extrairNomeArtista(mensagem);
            if (nome) {
                const artista = buscarArtista(nome, data);
                if (artista) {
                    novoArtista = artista.nome;
                    ultimoArtista = novoArtista;
                    resposta = artista.biografia || artista.curiosidade || `Conheça ${artista.nome}!`;
                    
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
                resposta = "Olá! Sou o Candinho, seu amigo artista. Pergunte sobre artistas, escritores, dança, arte ou peça uma piada! 🎨";
            } else if (msg.includes("obrigado") || msg.includes("obrigada")) {
                resposta = "Por nada! Fico muito contente em ajudar você. 🦆💛";
            } else if (msg.includes("ajuda")) {
                resposta = "Tente: 'Quem foi Carolina Maria de Jesus?', 'Quem foi Renoir?', 'O que é dança?' ou 'Conte uma piada'";
            } else {
                resposta = "Ainda estou aprendendo sobre esse assunto. Pergunte sobre um artista, escritor, conceito de arte ou peça uma piada! 🎨";
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
            reply: "Tive um pequeno contratempo técnico! 🎨 Pode perguntar de novo?",
            artista: null
        });
    }
}
