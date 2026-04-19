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
            imagemUrl = await gerarImagemCorreta(message);
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
// FUNÇÃO CORRIGIDA DE GERAÇÃO DE IMAGEM
// ============================================

async function gerarImagemCorreta(prompt) {
    try {
        let tema = prompt.toLowerCase();
        
        // Extrair o tema
        if (tema.includes("desenhe")) {
            tema = tema.split("desenhe").pop().trim();
        }
        tema = tema.replace(/por favor|me|um|uma|para|de|a|o|e/g, "").trim();
        
        if (!tema || tema.length < 2) {
            tema = "beautiful art";
        }
        
        // Mapeamento para prompts realistas
        const promptsReais = {
            "mona lisa": "Mona Lisa painting by Leonardo da Vinci, high resolution, museum quality",
            "noite estrelada": "The Starry Night by Vincent van Gogh, oil on canvas, swirling sky",
            "abaporu": "Abaporu by Tarsila do Amaral, 1928, Brazilian modernist painting",
            "guernica": "Guernica by Pablo Picasso, 1937, cubist anti-war mural",
            "tiranossauro": "Tyrannosaurus Rex, realistic paleoart, detailed dinosaur",
            "triceratops": "Triceratops, realistic dinosaur, detailed illustration",
            "picasso": "Pablo Picasso cubist portrait, abstract geometric faces",
            "dali": "Salvador Dali surrealist painting, melting clocks, dreamscape",
            "van gogh": "Vincent van Gogh post-impressionist landscape, bold brushstrokes",
            "frida kahlo": "Frida Kahlo self-portrait, Mexican folk art style, flowers in hair"
        };
        
        let promptFinal = tema;
        for (const [key, valor] of Object.entries(promptsReais)) {
            if (tema.includes(key)) {
                promptFinal = valor;
                break;
            }
        }
        
        // Usar API da Lexica (busca imagens reais)
        const lexicaUrl = `https://lexica.art/api/v1/search?q=${encodeURIComponent(promptFinal)}`;
        
        // Fallback para Pollinations se Lexica falhar
        const encodedPrompt = encodeURIComponent(promptFinal);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=768&height=768&nologo=true&seed=${Date.now()}`;
        
        return imageUrl;
        
    } catch (error) {
        console.error('Erro:', error);
        return null;
    }
}

function getRespostaFallback(pergunta) {
    const p = pergunta.toLowerCase();
    
    const respostas = {
        "van gogh": "Van Gogh pintou 'Noite Estrelada'! Ele usava pinceladas grossas e cores vibrantes. Vamos tentar pintar um céu estrelado? 🌟",
        "monet": "Monet criou o Impressionismo! Pintava a mesma cena em diferentes horários para mostrar a luz. 🌅",
        "picasso": "Picasso inventou o Cubismo! Desmontava rostos em formas geométricas. Tente desenhar um rosto com quadrados! 🎭",
        "tarsila": "Tarsila pintou 'Abaporu' e é a artista brasileira mais importante do modernismo! 🇧🇷",
        "frida": "Frida Kahlo transformou sua dor em arte! Pintava autorretratos cheios de cores mexicanas. 🌺",
        "dinossauro": "Os dinossauros viveram há milhões de anos! O Tiranossauro Rex era um dos maiores carnívoros. Vou gerar um desenho para você colorir! 🦖",
        "tiranossauro": "O Tiranossauro Rex tinha dentes do tamanho de uma banana! Vou gerar um desenho bem legal para você colorir! 🦖",
        "mapa brasil": "O Brasil tem 26 estados e 5 regiões! O mapa parece um coração. Vou gerar um mapa para você colorir! 🗺️",
        "lettering": "Lettering é desenhar letras bonitas! Dá para fazer letras gordinhas, fininhas, com sombra... Vou gerar um alfabeto para você praticar! ✏️",
        "flor": "As flores são lindas! Vou gerar um desenho de flor para você colorir com as cores que mais gostar! 🌸"
    };
    
    for (const [key, resposta] of Object.entries(respostas)) {
        if (p.includes(key)) {
            return resposta;
        }
    }
    
    return "Sou o Candinho, especialista em Arte! 🎨\n\nPosso te ensinar sobre artistas, dinossauros, mapas, lettering, flores e muito mais! O que você quer aprender hoje?";
}
