import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

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

let cacheData: any = null;

// ========================================
// FUNÇÕES AUXILIARES DE CARREGAMENTO
// ========================================

async function fetchComFallback(file: string) {
    const fetchUrl = async (fileName: string) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
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
    const results: any = {};
    
    console.log("📥 Carregando JSONs do GitHub...");
    const promessas = Object.entries(JSON_FILES).map(async ([key, file]) => {
        const data = await fetchComFallback(file);
        if (data) results[key] = data;
    });

    await Promise.all(promessas);
    cacheData = results;
    console.log(`✅ ${Object.keys(results).length} arquivos carregados.`);
    return results;
}

// ========================================
// NORMALIZAÇÃO E BUSCA FLEXÍVEL
// ========================================

function normalizar(str: string) {
    if (!str) return "";
    return str.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, "").trim();
}

function compararNomes(pesquisa: string, alvo: string) {
    if (!pesquisa || !alvo) return false;
    const p = normalizar(pesquisa);
    const a = normalizar(alvo);
    if (p === a) return true;
    
    if (p.length >= 4 && (a.includes(p) || p.includes(a))) {
        return true;
    }
    return false;
}

function extrairTexto(campo: any): string {
    if (!campo) return "";
    if (Array.isArray(campo)) {
        return campo
            .map(item => typeof item === "string" ? item.trim() : "")
            .filter(Boolean)
            .join(" ");
    }
    return typeof campo === "string" ? campo.trim() : String(campo);
}

function limitarTextoAmigavel(texto: string, maxCaracteres = 380) {
    if (!texto || texto.length <= maxCaracteres) return texto;
    const sub = texto.substring(0, maxCaracteres);
    const ultimoPonto = Math.max(sub.lastIndexOf("."), sub.lastIndexOf("!"), sub.lastIndexOf("?"));
    if (ultimoPonto > 150) {
        return sub.substring(0, ultimoPonto + 1);
    }
    return sub + "...";
}

function buscarArtista(nome: string, data: any) {
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
                              palavras.some((p: string) => compararNomes(nome, p));
                              
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

function buscarConceito(pergunta: string, data: any) {
    const texto = normalizar(pergunta);
    
    if (texto.includes("danca") || texto.includes("dança")) {
        const dancas = data.dancas;
        if (dancas && dancas.o_que_e_danca) {
            return extrairTexto(dancas.o_que_e_danca.explicacao_infantil) || extrairTexto(dancas.o_que_e_danca.inicio);
        }
        return "Dança é a arte de movimentar o corpo seguindo o ritmo da música! É uma forma maravilhosa de se expressar! 💃✨";
    }
    
    if (texto.includes("arte")) {
        const arte = data.artes_visuais;
        if (arte && arte.o_que_e_arte) {
            return extrairTexto(arte.o_que_e_arte.explicacao_infantil) || extrairTexto(arte.o_que_e_arte.inicio);
        }
        return "Arte é tudo aquilo que criamos usando a nossa imaginação, sentimentos e criatividade! 🎨🌟";
    }
    
    if (texto.includes("desenho")) {
        const arte = data.artes_visuais;
        if (arte && arte.o_que_e_desenho) {
            return extrairTexto(arte.o_que_e_desenho.explicacao_infantil) || extrairTexto(arte.o_que_e_desenho.inicio);
        }
        return "Desenho é criar formas, lines e caminhos em um papel para mostrar o que nossa imaginação está pensando! ✏️✨";
    }

    // Busca mais ampla em literaturas e outros
    const buscasEspeciais = [
        { termos: ["cantiga", "roda", "ciranda"], fonte: "cantigas_de_roda" },
        { termos: ["literatura", "escritor"], fonte: "literatura_conceitos" },
        { termos: ["folclore", "lenda"], fonte: "folclore" },
        { termos: ["musica", "ritmo"], fonte: "musica" },
        { termos: ["teatro", "palco"], fonte: "teatro" },
        { termos: ["piada"], fonte: "piadas" }
    ];

    for (const busca of buscasEspeciais) {
        if (busca.termos.some(t => texto.includes(t))) {
            const conteudo = data[busca.fonte];
            if (conteudo) {
                // Se for piada, pega uma aleatória
                if (busca.fonte === "piadas") {
                    const lista = Object.values(conteudo);
                    if (lista.length) {
                        const p: any = lista[Math.floor(Math.random() * lista.length)];
                        return typeof p === "string" ? p : (extrairTexto(p.explicacao_infantil) || extrairTexto(p.resposta) || extrairTexto(p.pergunta));
                    }
                }
                // Busca por chave dentro do JSON
                for (const [chave, info] of Object.entries(conteudo)) {
                    if (compararNomes(pergunta, chave)) {
                        return extrairTexto((info as any).explicacao_infantil) || extrairTexto((info as any).inicio) || extrairTexto(info as any);
                    }
                }
            }
        }
    }
    
    return null;
}

async function buscarImagem(artistaNome: string) {
    if (!EUROPEANA_API_KEY || EUROPEANA_API_KEY === "SUA_CHAVE_AQUI" || EUROPEANA_API_KEY === "") return null;
    try {
        const query = `"${encodeURIComponent(artistaNome)}" AND painting`;
        const url = `https://api.europeana.eu/record/v2/search.json?wskey=${EUROPEANA_API_KEY}&query=${query}&qf=TYPE:IMAGE&rows=3`;
        const response = await fetch(url);
        const data = await response.json() as any;
        if (data.items && data.items.length) {
            const item = data.items.find((i: any) => i.title?.[0]?.toLowerCase().includes(artistaNome.toLowerCase())) || data.items[0];
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

function extrairNomeArtista(pergunta: string) {
    const match = pergunta.match(/quem (foi|é|era)\s+([A-Za-zÀ-ÖØ-öø-ÿ\s]+)/i);
    return match ? match[2].trim().replace(/[?!.,]+$/, '') : null;
}

// API Routes
app.post("/api/chat", async (req, res) => {
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
            } else {
                // Tentativa de busca direta por nome se o usuário apenas digitou o nome
                const artista = buscarArtista(mensagem, data);
                if (artista) {
                    novoArtista = artista.nome;
                    ultimoArtista = novoArtista;
                    resposta = artista.biografia || artista.curiosidade;
                    resposta = limitarTextoAmigavel(resposta!, 380);
                    imagem = await buscarImagem(artista.nome);
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
        return res.status(500).json({
            reply: "Tive um pequeno contratempo técnico! 🎨 Pode perguntar de novo?",
            artista: null
        });
    }
});

async function startServer() {
  // Serve frontend
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
