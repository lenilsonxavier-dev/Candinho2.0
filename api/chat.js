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
        let textoOriginal = prompt.toLowerCase();
        
        // Extrair o tema
        let tema = "";
        if (textoOriginal.includes("desenhe") || textoOriginal.includes("desenho")) {
            let match = textoOriginal.match(/(?:desenhe|desenho|desenha|faca um|crie um)\s+(.+)/i);
            if (match) {
                tema = match[1];
            } else {
                tema = textoOriginal.replace(/desenhe|desenho|colorir|me|um|uma|para|de|a|o|e|por favor/g, "").trim();
            }
        } else {
            tema = textoOriginal.replace(/desenhe|desenho|colorir|me|um|uma|para|de|a|o|e/g, "").trim();
        }
        
        if (!tema || tema.length < 2) {
            tema = "arte";
        }
        
        // Mapeamento específico sem filtro de segurança
        const mapeamento = {
            // Obras de arte famosas (sem filtro)
            "mona lisa": "Mona Lisa by Leonardo da Vinci, realistic, detailed, painting",
            "noite estrelada": "Starry Night by Vincent van Gogh, oil painting, swirling sky",
            "abaporu": "Abaporu painting by Tarsila do Amaral, modernist, Brazilian art",
            "guernica": "Guernica by Pablo Picasso, cubist, black and white, anti-war",
            "girassois": "Sunflowers by Vincent van Gogh, still life, yellow flowers",
            "o grito": "The Scream by Edvard Munch, expressionist, figure screaming",
            "persistencia da memoria": "The Persistence of Memory by Salvador Dali, melting clocks, surrealist",
            "moça com brinco de pérola": "Girl with a Pearl Earring by Vermeer, portrait",
            
            // Autorretratos famosos
            "autorretrato van gogh": "Self-portrait by Vincent van Gogh, with bandaged ear",
            "autorretrato frida": "Self-portrait by Frida Kahlo, with monkeys, Mexican art",
            "autorretrato rembrandt": "Self-portrait by Rembrandt, Baroque painting, old master",
            
            // Dinossauros realistas
            "tiranossauro": "Tyrannosaurus Rex, realistic dinosaur, detailed, paleoart",
            "triceratops": "Triceratops, realistic dinosaur, three horns, detailed",
            "velociraptor": "Velociraptor, realistic dinosaur, feathered, detailed",
            "braquiossauro": "Brachiosaurus, realistic dinosaur, long neck, detailed",
            
            // Artistas em seus estilos
            "picasso": "Cubist portrait, Picasso style, geometric shapes, abstract",
            "dali": "Surrealist landscape, Salvador Dali style, melting objects, dreamlike",
            "monet": "Impressionist garden, Claude Monet style, water lilies, blurred",
            "van gogh": "Post-impressionist landscape, Van Gogh style, swirling brushstrokes",
            
            // Paisagens e naturezas
            "por do sol": "Sunset landscape, vibrant colors, realistic sky",
            "montanha": "Mountain landscape, detailed, realistic, snow peaks",
            "praia": "Beach scene, ocean waves, sand, realistic",
            "floresta": "Forest with trees, realistic, detailed leaves",
            
            // Animais realistas
            "leao": "Lion, realistic, detailed fur, majestic",
            "elefante": "Elephant, realistic, detailed skin, African savanna",
            "gato": "Cat, realistic, detailed fur, domestic animal",
            "cachorro": "Dog, realistic, detailed, pet portrait"
        };
        
        let promptImagem = null;
        for (const [key, valor] of Object.entries(mapeamento)) {
            if (tema.includes(key)) {
                promptImagem = valor;
                break;
            }
        }
        
        if (!promptImagem) {
            promptImagem = `${tema}, detailed, realistic, high quality, no children, no cartoon`;
        }
        
        console.log("Gerando imagem:", promptImagem);
        
        // Usar Pollinations com modelo de qualidade e sem filtro
        const encodedPrompt = encodeURIComponent(promptImagem);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=768&height=768&nologo=true&model=flux&seed=${Math.floor(Math.random() * 10000)}`;
        
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
