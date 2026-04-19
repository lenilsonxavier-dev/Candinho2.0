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
            imagemUrl = await gerarImagemComHuggingFace(message);
            // Se Hugging Face falhar, usa Pollinations
            if (!imagemUrl) {
                imagemUrl = await gerarImagemPollinations(message);
            }
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
// HUGGING FACE - GERAÇÃO DE IMAGEM (PREFERENCIAL)
// ============================================

async function gerarImagemComHuggingFace(prompt) {
    try {
        const tema = extrairTema(prompt);
        
        // Mapeamento de temas para prompts profissionais
        const promptsMap = {
            "mona lisa": "Leonardo da Vinci, Mona Lisa, Renaissance portrait, sfumato technique, Louvre museum",
            "noite estrelada": "Vincent van Gogh, The Starry Night, post-impressionism, swirling sky, oil on canvas",
            "abaporu": "Tarsila do Amaral, Abaporu, 1928, Brazilian modernism, surrealist figure with giant foot",
            "guernica": "Pablo Picasso, Guernica, 1937, cubist mural, anti-war, black and white",
            "girassois": "Van Gogh, Sunflowers, still life, yellow flowers in vase",
            "o grito": "Edvard Munch, The Scream, expressionist, figure screaming on bridge",
            "tiranossauro": "Tyrannosaurus Rex, photorealistic paleoart, detailed scales, sharp teeth",
            "triceratops": "Triceratops, realistic dinosaur, three horns, detailed skin texture",
            "velociraptor": "Velociraptor, realistic dinosaur, feathered, detailed",
            "braquiossauro": "Brachiosaurus, realistic, long neck, detailed",
            "picasso": "Cubist portrait, Pablo Picasso style, geometric shapes, abstract face",
            "dali": "Surrealist landscape, Salvador Dali style, melting clocks, dreamlike",
            "monet": "Impressionist garden, Claude Monet style, water lilies, blurred brushstrokes",
            "van gogh": "Post-impressionist landscape, Van Gogh style, bold colors, swirling sky",
            "frida kahlo": "Frida Kahlo self-portrait, Mexican folk art, flowers in hair",
            "por do sol": "Sunset over ocean, dramatic orange and purple sky, realistic",
            "floresta amazonica": "Amazon rainforest, Brazil, detailed trees, tropical vegetation"
        };
        
        let promptFinal = promptsMap[tema];
        if (!promptFinal) {
            promptFinal = `${tema}, professional artwork, high resolution, masterpiece, detailed, realistic, art museum quality`;
        }
        
        // Tentar múltiplos modelos do Hugging Face
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
                                negative_prompt: "cartoon, children, cute, baby, coloring page, simple line art, low quality, childish",
                                width: 768,
                                height: 768,
                                num_inference_steps: 20
                            }
                        })
                    }
                );
                
                if (response.ok) {
                    const blob = await response.blob();
                    const imageUrl = URL.createObjectURL(blob);
                    return imageUrl;
                }
            } catch (err) {
                console.log(`Modelo ${modelo} falhou:`, err.message);
                continue;
            }
        }
        
        return null;
        
    } catch (error) {
        console.error('Erro Hugging Face:', error);
        return null;
    }
}

// ============================================
// POLLINATIONS - FALLBACK
// ============================================

async function gerarImagemPollinations(prompt) {
    try {
        const tema = extrairTema(prompt);
        
        const promptsMap = {
            "mona lisa": "Mona Lisa by Leonardo da Vinci, Renaissance painting",
            "noite estrelada": "Starry Night by Van Gogh, oil painting, swirling sky",
            "abaporu": "Abaporu by Tarsila do Amaral, Brazilian modernism",
            "tiranossauro": "Tyrannosaurus Rex, realistic dinosaur, detailed",
            "triceratops": "Triceratops, realistic dinosaur, detailed",
            "picasso": "Cubist portrait, Picasso style",
            "dali": "Surrealist melting clocks, Dali style",
            "van gogh": "Van Gogh landscape, swirling brushstrokes"
        };
        
        let promptFinal = promptsMap[tema];
        if (!promptFinal) {
            promptFinal = `${tema}, professional artwork, realistic, high quality, masterpiece`;
        }
        
        const negativePrompt = "children, cartoon, cute, coloring page, childish, infantilized";
        const encodedPrompt = encodeURIComponent(promptFinal);
        const encodedNegative = encodeURIComponent(negativePrompt);
        
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&model=flux&negative_prompt=${encodedNegative}`;
        
        return imageUrl;
        
    } catch (error) {
        console.error('Erro Pollinations:', error);
        return null;
    }
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
    
    // Mapear variações
    const mapeamentos = {
        "monalisa": "mona lisa",
        "noite estrelada": "noite estrelada",
        "abaporu": "abaporu",
        "t-rex": "tiranossauro",
        "trex": "tiranossauro",
        "van gogh": "van gogh",
        "picasso": "picasso",
        "dali": "dali",
        "frida": "frida kahlo",
        "portinari": "portinari"
    };
    
    for (const [key, value] of Object.entries(mapeamentos)) {
        if (tema.includes(key)) {
            return value;
        }
    }
    
    return tema;
}

function getRespostaFallback(pergunta) {
    const p = pergunta.toLowerCase();
    
    const respostas = {
        "mona lisa": "A Mona Lisa de Leonardo da Vinci tem o sorriso mais famoso do mundo! Vou gerar a imagem dessa obra-prima para você! 🖼️",
        "noite estrelada": "Van Gogh pintou 'Noite Estrelada' em 1889. O céu parece se mover com as pinceladas em espiral! 🌟",
        "abaporu": "Abaporu significa 'homem que come gente' em tupi. Tarsila pintou essa obra icônica em 1928! 🇧🇷",
        "tiranossauro": "O Tiranossauro Rex era o maior predador do período Jurássico! Vou gerar uma imagem realista para você! 🦖",
        "picasso": "Picasso inventou o Cubismo! Ele desmontava os rostos em formas geométricas. 🎭",
        "van gogh": "Van Gogh pintou mais de 2.000 obras! Suas pinceladas grossas e cores vibrantes são únicas! 🌻",
        "dali": "Salvador Dali pintava sonhos! Seus relógios derretidos são famosos no mundo todo! ⌛",
        "frida kahlo": "Frida Kahlo transformou sua dor em arte! Seus autorretratos são cheios de simbolismo mexicano! 🌺",
        "portinari": "Portinari pintou a vida do povo brasileiro: retirantes, café e crianças brincando! ☕"
    };
    
    for (const [key, resposta] of Object.entries(respostas)) {
        if (p.includes(key)) {
            return resposta;
        }
    }
    
    return "Sou o Candinho, especialista em Arte! 🎨\n\nVocê pode me pedir para mostrar obras famosas como Mona Lisa, Noite Estrelada, Abaporu, ou dinossauros realistas! O que você quer ver hoje?";
}
