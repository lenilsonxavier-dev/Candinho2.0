export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    const { message, gerarImagem } = req.body;
    
    if (!message) {
        return res.status(400).json({ error: 'Mensagem não fornecida' });
    }

    try {
        const apiKey = process.env.GROQ_API_KEY;
        
        let respostaIA = null;
        
        if (apiKey && apiKey.startsWith('gsk_')) {
            respostaIA = await getRespostaGroq(message, apiKey);
        }
        
        if (!respostaIA) {
            respostaIA = getRespostaFallback(message);
        }
        
        let imagemUrl = null;
        if (gerarImagem) {
            // Tenta múltiplos provedores em sequência
            imagemUrl = await gerarImagemMultiProvedor(message);
        }
        
        res.status(200).json({
            resposta: respostaIA,
            imagem: imagemUrl
        });
        
    } catch (error) {
        console.error('Erro geral:', error);
        res.status(200).json({
            resposta: getRespostaFallback(message),
            imagem: null
        });
    }
}

async function getRespostaGroq(pergunta, apiKey) {
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                    {
                        role: "system",
                        content: `Você é o Candinho, professor de arte de 60 anos.
- Fale de forma educativa, lúdica e acolhedora
- Use "você" ou "criança" - NUNCA use "meu jovem", "meu amigo"
- Responda sobre arte, artistas, dinossauros, mapas, danças, emoções
- Respostas de 2-4 frases, diretas e com emojis`
                    },
                    { role: "user", content: pergunta }
                ],
                max_tokens: 200,
                temperature: 0.7
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.choices && data.choices[0] && data.choices[0].message) {
                let resposta = data.choices[0].message.content;
                resposta = resposta.replace(/meu jovem|meu amigo|querido|meu caro/gi, '');
                return resposta.trim();
            }
        }
        return null;
        
    } catch (error) {
        console.error('Erro Groq:', error);
        return null;
    }
}

// ============================================
// SISTEMA DE MÚLTIPLOS PROVEDORES DE IMAGEM
// ============================================

async function gerarImagemMultiProvedor(prompt) {
    // Extrair o tema do prompt
    let tema = extrairTema(prompt);
    
    // Lista de provedores em ordem de preferência
    const provedores = [
        () => gerarComHuggingFace(tema),
        () => gerarComPollinationsProfissional(tema),
        () => gerarComLexica(tema),
        () => gerarComLocalAI(tema)
    ];
    
    // Tenta cada provedor até um funcionar
    for (const provedor of provedores) {
        try {
            const imagem = await provedor();
            if (imagem) {
                console.log(`✅ Imagem gerada com sucesso`);
                return imagem;
            }
        } catch (error) {
            console.log(`Provedor falhou:`, error.message);
            continue;
        }
    }
    
    return null;
}

function extrairTema(prompt) {
    let tema = prompt.toLowerCase();
    
    // Remove palavras comuns de comando
    tema = tema.replace(/desenhe|desenho|colorir|me|um|uma|para|de|a|o|e|por favor|crie|faça|gere/g, "");
    tema = tema.replace(/imagem|figura|ilustração|pintura|obra|arte/g, "");
    tema = tema.trim();
    
    if (!tema || tema.length < 2) {
        tema = "beautiful landscape painting";
    }
    
    return tema;
}

// PROVEDOR 1: Hugging Face (gratuito, modelos profissionais)
async function gerarComHuggingFace(tema) {
    // Mapeamento de temas para prompts profissionais
    const promptsProfissionais = {
        // Obras de arte famosas
        "mona lisa": "Leonardo da Vinci, Mona Lisa, Renaissance portrait, sfumato technique, Louvre museum quality",
        "noite estrelada": "Vincent van Gogh, The Starry Night, post-impressionism, swirling sky, oil on canvas",
        "abaporu": "Tarsila do Amaral, Abaporu, 1928, Brazilian modernism, surrealist figure with giant foot",
        "guernica": "Pablo Picasso, Guernica, 1937, cubist mural, anti-war, black and white",
        "girassois": "Van Gogh, Sunflowers, still life, yellow flowers in vase",
        "o grito": "Edvard Munch, The Scream, expressionist, figure screaming on bridge",
        "persistencia": "Salvador Dali, The Persistence of Memory, surrealism, melting clocks",
        
        // Autorretratos
        "autorretrato van gogh": "Van Gogh self-portrait, post-impressionist, bandaged ear",
        "autorretrato frida": "Frida Kahlo self-portrait, Mexican folk art, flowers in hair, unibrow",
        "autorretrato rembrandt": "Rembrandt self-portrait, Baroque painting, dramatic lighting",
        
        // Dinossauros realistas
        "tiranossauro": "Tyrannosaurus Rex, photorealistic paleoart, detailed scales, sharp teeth, Jurassic period",
        "triceratops": "Triceratops, realistic dinosaur, three horns, herbivore, Cretaceous period",
        "velociraptor": "Velociraptor, realistic dinosaur, feathered, intelligent predator",
        "braquiossauro": "Brachiosaurus, realistic, long neck, feeding on treetops",
        
        // Estilos de artistas
        "picasso cubista": "Cubist portrait, Pablo Picasso style, geometric shapes, abstract face",
        "dali surrealista": "Surrealist landscape, Salvador Dali style, melting objects, dreamlike",
        "monet impressionista": "Impressionist garden, Claude Monet style, water lilies, blurred brushstrokes",
        "van gogh pos impressionista": "Post-impressionist landscape, Van Gogh style, bold colors, swirling sky",
        
        // Paisagens
        "por do sol": "Sunset over ocean, dramatic orange and purple sky, realistic, high detail",
        "montanha": "Mountain range with snow peaks, realistic landscape, dramatic lighting",
        "floresta amazônica": "Amazon rainforest, Brazil, detailed trees, tropical vegetation, realistic",
        
        // Padrão
        "padrao": `${tema}, professional artwork, high resolution, masterpiece, detailed, realistic, art museum quality`
    };
    
    let promptFinal = promptsProfissionais[tema] || promptsProfissionais["padrao"];
    
    // Tenta usar o modelo FLUX do Hugging Face (gratuito)
    const modelos = [
        "black-forest-labs/FLUX.1-dev",
        "stabilityai/stable-diffusion-3.5-large",
        "stabilityai/stable-diffusion-xl-base-1.0"
    ];
    
    for (const modelo of modelos) {
        try {
            const response = await fetch(
                `https://api-inference.huggingface.co/models/${modelo}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        inputs: promptFinal,
                        parameters: {
                            negative_prompt: "cartoon, children, cute, baby, coloring page, simple line art, low quality",
                            width: 768,
                            height: 768
                        }
                    })
                }
            );
            
            if (response.ok) {
                const blob = await response.blob();
                // Converter blob para URL temporária
                const imageUrl = URL.createObjectURL(blob);
                return imageUrl;
            }
        } catch (err) {
            continue;
        }
    }
    
    return null;
}

// PROVEDOR 2: Pollinations com parâmetros anti-filtro
async function gerarComPollinationsProfissional(tema) {
    // Prompt profissional sem termos que disparam filtros
    const promptProfissional = `${tema}, professional artwork, detailed, realistic, high quality, museum piece, masterpiece, no cartoon, no child, no coloring page`;
    
    const negativePrompt = "children, kid, baby, cute, cartoon, coloring page, simple line art, childish, infantilized";
    
    const encodedPrompt = encodeURIComponent(promptProfissional);
    const encodedNegative = encodeURIComponent(negativePrompt);
    
    // Múltiplas tentativas com diferentes parâmetros
    const urls = [
        `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&model=flux&negative_prompt=${encodedNegative}`,
        `https://image.pollinations.ai/prompt/${encodedPrompt}?width=768&height=768&nologo=true&seed=${Date.now()}`
    ];
    
    for (const url of urls) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            if (response.ok) {
                return url;
            }
        } catch (err) {
            continue;
        }
    }
    
    return urls[0];
}

// PROVEDOR 3: Lexica.art (busca imagens reais)
async function gerarComLexica(tema) {
    const searchTerms = {
        "mona lisa": "Mona Lisa painting",
        "noite estrelada": "Van Gogh Starry Night",
        "abaporu": "Tarsila Abaporu",
        "tiranossauro": "Tyrannosaurus Rex realistic",
        default: `${tema} famous painting`
    };
    
    let searchTerm = searchTerms[tema] || searchTerms.default;
    
    try {
        const response = await fetch(`https://lexica.art/api/v1/search?q=${encodeURIComponent(searchTerm)}`);
        
        if (response.ok) {
            const data = await response.json();
            if (data.images && data.images.length > 0) {
                // Pega uma imagem real da obra
                return data.images[0].url;
            }
        }
    } catch (err) {
        console.log("Lexica falhou:", err);
    }
    
    return null;
}

// PROVEDOR 4: LocalAI (auto-hospedado - mais controle)
async function gerarComLocalAI(tema) {
    // Para usar com LocalAI instalado localmente
    // Endereço do servidor LocalAI (se estiver rodando)
    const localAIUrl = process.env.LOCAL_AI_URL || 'http://localhost:8080';
    
    try {
        const response = await fetch(`${localAIUrl}/v1/images/generations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: `${tema}, professional artwork, high quality`,
                model: "stabilityai/stable-diffusion-xl-base-1.0",
                n: 1,
                size: "768x768"
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.data && data.data[0] && data.data[0].url) {
                return data.data[0].url;
            }
        }
    } catch (err) {
        console.log("LocalAI não disponível");
    }
    
    return null;
}

function getRespostaFallback(pergunta) {
    const p = pergunta.toLowerCase();
    
    if (p.includes("van gogh")) {
        return "Van Gogh pintou 'Noite Estrelada' e 'Girassóis'! Ele usava pinceladas grossas e cores vibrantes. Vou gerar uma imagem da obra para você! 🌟";
    }
    if (p.includes("mona lisa")) {
        return "A Mona Lisa de Leonardo da Vinci tem o sorriso mais famoso do mundo! Vou gerar a imagem dessa obra-prima para você! 🖼️";
    }
    if (p.includes("picasso")) {
        return "Picasso inventou o Cubismo! Desmontava rostos em formas geométricas. Vou gerar uma imagem no estilo cubista para você! 🎭";
    }
    if (p.includes("tarsila")) {
        return "Tarsila pintou 'Abaporu', a obra mais importante do modernismo brasileiro! Vou gerar a imagem para você! 🇧🇷";
    }
    if (p.includes("tiranossauro") || p.includes("dinossauro")) {
        return "O Tiranossauro Rex era o maior predador do período Jurássico! Vou gerar uma imagem realista para você! 🦖";
    }
    
    return "Sou o Candinho, especialista em Arte! 🎨\n\nPosso te mostrar imagens de obras famosas como Mona Lisa, Noite Estrelada e Abaporu, além de dinossauros realistas! O que você quer ver?";
}
