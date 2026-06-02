import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { bibliotecaCultural } from "./src/data/bibliotecaCultural.js";

const app = express();
const PORT = 3000;

app.use(express.json());

// Inicializa a IA Gemini se houver chave configurada
const apiKey = process.env.GEMINI_API_KEY || "";
const ai = apiKey
  ? new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    })
  : null;

const GITHUB_BASE = "https://raw.githubusercontent.com/lenilsonxavier-dev/Candinho2.0/main/data/";
let bibliotecaCache: any = null;

async function carregarBiblioteca() {
  if (bibliotecaCache) return bibliotecaCache;
  try {
    const res = await fetch(`${GITHUB_BASE}bibliotecaCultural.json`);
    const libGitHub = res.ok ? await res.json() : {};
    bibliotecaCache = { ...bibliotecaCultural, ...libGitHub };
  } catch (e) {
    console.warn("Utilizando biblioteca cultural local de fallback:", e);
    bibliotecaCache = bibliotecaCultural;
  }
  return bibliotecaCache;
}

// --- BUSCA NO PEXELS (FALLBACK SECUNDÁRIO) ---
async function buscarNoPexels(termo: string) {
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (!pexelsKey) return null;
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(termo + " painting art")}&per_page=1&orientation=square`;
    const res = await fetch(url, {
      headers: { Authorization: pexelsKey }
    });
    if (res.ok) {
      const data: any = await res.json();
      if (data.photos && data.photos.length > 0) {
        const photo = data.photos[0];
        return {
          imagemUrl: photo.src.medium,
          titulo: `Arte de ${termo}`,
          credito: `${photo.photographer} / Pexels`
        };
      }
    }
  } catch (e) {
    console.error("Erro Pexels:", e);
  }
  return null;
}

// --- BUSCA NA WIKIMEDIA (EXCLUSIVA E FILTRADA) ---
async function buscarNaWikimedia(artistaNome: string) {
  try {
    if (!artistaNome) return null;

    // 1. Busca específica por obra/pintura do artista (prioriza pinturas)
    let termoBusca = `${artistaNome} painting`;
    let url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(termoBusca)}&gsrlimit=8&prop=imageinfo&iiprop=url|mime|mediatype|extmetadata&iiurlwidth=800`;

    let res = await fetch(url);
    let data: any = await res.json();

    if (data.query && data.query.pages) {
      let pages = Object.values(data.query.pages);
      
      // Filtra apenas imagens compatíveis (BITMAP ou DRAWING + mime legítimo)
      let imagens = pages.filter((p: any) => {
        if (!p.imageinfo || !p.imageinfo[0]) return false;
        const info = p.imageinfo[0];
        const mime = (info.mime || "").toLowerCase();
        const media = (info.mediatype || "").toUpperCase();
        return (media === "BITMAP" || media === "DRAWING") &&
               (mime.includes("jpeg") || mime.includes("jpg") || mime.includes("png") || mime.includes("gif") || mime.includes("webp"));
      });

      if (imagens.length > 0) {
        const imgPage: any = imagens[0];
        const info = imgPage.imageinfo[0];
        const imgUrl = info.thumburl || info.url;

        let credito = "Wikimedia Commons";
        if (info.extmetadata) {
          if (info.extmetadata.Artist?.value) {
            credito = info.extmetadata.Artist.value.replace(/<[^>]*>/g, "").trim();
          } else if (info.extmetadata.Credit?.value) {
            credito = info.extmetadata.Credit.value.replace(/<[^>]*>/g, "").trim();
          }
        }
        if (credito.length > 50) {
          credito = credito.substring(0, 47) + "...";
        }

        let tituloOriginal = imgPage.title.replace("File:", "").split(".")[0];
        let titulo = decodeURIComponent(tituloOriginal).replace(/_/g, " ");

        return {
          imagemUrl: imgUrl,
          titulo: titulo || "Obra de Arte",
          credito: credito || "Wikimedia Commons (obra de arte)"
        };
      }
    }

    // 2. Segunda tentativa: busca mais genérica se a primeira não retornar compatíveis
    url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(artistaNome)}&gsrlimit=5&prop=imageinfo&iiprop=url|mime|mediatype|extmetadata&iiurlwidth=800`;
    res = await fetch(url);
    data = await res.json();

    if (data.query && data.query.pages) {
      let pages = Object.values(data.query.pages);
      let imgPage: any = pages.find((p: any) => {
        if (!p.imageinfo || !p.imageinfo[0]) return false;
        const info = p.imageinfo[0];
        const mime = (info.mime || "").toLowerCase();
        const media = (info.mediatype || "").toUpperCase();
        return (media === "BITMAP" || media === "DRAWING") &&
               (mime.includes("jpeg") || mime.includes("jpg") || mime.includes("png"));
      });

      if (!imgPage) {
        imgPage = pages.find((p: any) => p.imageinfo && p.imageinfo[0] && p.imageinfo[0].thumburl);
      }

      if (imgPage) {
        const info = imgPage.imageinfo[0];
        const imgUrl = info.thumburl || info.url;

        let credito = "Wikimedia Commons";
        if (info.extmetadata) {
          if (info.extmetadata.Artist?.value) {
            credito = info.extmetadata.Artist.value.replace(/<[^>]*>/g, "").trim();
          } else if (info.extmetadata.Credit?.value) {
            credito = info.extmetadata.Credit.value.replace(/<[^>]*>/g, "").trim();
          }
        }
        if (credito.length > 50) {
          credito = credito.substring(0, 47) + "...";
        }

        let tituloOriginal = imgPage.title.replace("File:", "").split(".")[0];
        let titulo = decodeURIComponent(tituloOriginal).replace(/_/g, " ");

        return {
          imagemUrl: imgUrl,
          titulo: titulo || "Obra de Arte",
          credito: credito || "Wikimedia Commons"
        };
      }
    }
  } catch (e) {
    console.error("Erro no Wikimedia:", e);
  }
  return null;
}

// --- BUSCANTE UNIFICADO ---
async function buscarImagem(pergunta: string) {
  try {
    const stopWords = ["quem", "foi", "fale", "sobre", "ver", "obra", "quando", "nasceu", "morreu", "mostre", "imagem", "foto", "quadro", "pintura", "desenho", "ilustração", "retrato"];
    let palavras = pergunta.toLowerCase()
      .replace(/[?!.,]/g, "")
      .split(/\s+/)
      .filter(p => p.length > 2 && !stopWords.includes(p));
    
    let termo = palavras.join(" ");
    if (!termo) return null;

    let img = await buscarNaWikimedia(termo);
    if (!img) {
      img = await buscarNoPexels(termo);
    }
    return img;
  } catch (e) {
    console.error("Erro na busca unificada de imagem:", e);
  }
  return null;
}

// --- API ROTAS ---
app.post("/api/groq", async (req: Request, res: Response) => {
  try {
    const { mensagem } = req.body;
    if (!mensagem || typeof mensagem !== "string") {
      return res.status(400).json({ error: "Mensagem é obrigatória" });
    }

    const lib = await carregarBiblioteca();
    const textoBusca = mensagem.toLowerCase();

    let textoFinal = "";
    let infoExtra = { nascimento: "", morte: "", estilo: "" };

    // 1. PRIORIDADE TOTAL: Busca na Biblioteca Cultural (Curadoria Local)
    for (const chave in lib) {
      const item = lib[chave];
      if (item.palavras_chave && item.palavras_chave.some((p: string) => textoBusca.includes(p.toLowerCase()))) {
        if (item.inicio && item.inicio.length > 0 && item.explicacao_curta && item.explicacao_curta.length > 0) {
          textoFinal = `${item.inicio[0]} ${item.explicacao_curta[0]}`;
        }
        infoExtra = {
          nascimento: item.ano_nascimento || "---",
          morte: item.ano_falecimento || "---",
          estilo: item.categoria || "Arte"
        };
        break;
      }
    }

    // 2. Se não achou localmente, chama a IA (Gemini como o robô do Candinho)
    if (!textoFinal) {
      if (ai) {
        const responseGemini = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: mensagem,
          config: {
            systemInstruction: 
              "Você é o Candinho, um professor de arte e pintor muito simpático e acolhedor para crianças de 10 anos. " +
              "Responda sempre em português de forma simples, alegre e muito breve (máximo 3 frases). " +
              "Sempre use uma linguagem positiva e entusiasmada, usando analogias de pintura e pinceladas. " +
              "NUNCA repita o nome do artista mais de duas vezes. " +
              "Se não descobrir sobre quem é o artista, responda gentilmente: 'Não conheço esse artista ainda, mas vou pesquisar na minha paleta! 🎨'. " +
              "Diga se o artista nasceu ou faleceu em tal época de forma amigável no corpo do texto, sem criar listas ou cabeçalhos.",
            temperature: 0.5,
          },
        });
        textoFinal = responseGemini.text || "";
      } else {
        textoFinal = "Olá! Adoraria conversar, mas minha paleta de cores eletrônica precisa de uma chave de ativação nas configurações! 🎨";
      }
    }

    // 3. Busca imagem com tratamento estrito de formato
    const imagemResult = await buscarImagem(mensagem);

    // 4. Retorno unificado
    return res.status(200).json({
      reply: textoFinal || "Que pergunta curiosa! Vamos descobrir juntos sobre arte? 🎨",
      image: imagemResult,
      info: infoExtra.nascimento || infoExtra.morte || infoExtra.estilo ? infoExtra : null,
      googleArts: { url: `https://artsandculture.google.com/search?q=${encodeURIComponent(mensagem)}` }
    });

  } catch (error) {
    console.error("Erro Geral no Servidor:", error);
    return res.status(200).json({ reply: "Ops! Minhas tintas secaram um pouquinho. Pode repetir o que disse? 🎨" });
  }
});

// Inicialização das rotas do servidor e do canal Vite
async function startServer() {
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
