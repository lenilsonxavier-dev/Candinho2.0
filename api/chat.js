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
        // Usar Groq para conversa (já funciona)
        const groqApiKey = process.env.GROQ_API_KEY;
        let respostaIA = null;
        
        if (groqApiKey && groqApiKey.startsWith('gsk_')) {
            respostaIA = await getRespostaGroq(message, groqApiKey);
        }
        
        if (!respostaIA) {
            respostaIA = getRespostaFallback(message);
        }
        
        // Usar OpenAI DALL-E para imagens!
        let imagemUrl = null;
        if (gerarImagem) {
            imagemUrl = await gerarImagemComOpenAI(message);
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
- Respostas de 2-4 frases, diretas e com emojis
- Quando pedirem uma imagem, diga que vai gerar uma obra linda para colorir ou admirar`
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
// OPENAI DALL-E 3 - GERAÇÃO PROFISSIONAL DE IMAGENS
// ============================================

async function gerarImagemComOpenAI(prompt) {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
        console.log("OPENAI_API_KEY não configurada");
        return null;
    }
    
    try {
        const tema = extrairTema(prompt);
        
        // Mapeamento de temas para prompts profissionais do DALL-E 3
        const promptsProfissionais = {
            // Obras de arte famosas
            "mona lisa": "A ultra-realistic, high-resolution image of Leonardo da Vinci's Mona Lisa painting. Renaissance portrait, sfumato technique, mysterious smile, detailed brushstrokes, Louvre museum quality, masterpiece, oil on canvas, 16th century Italian art",
            
            "noite estrelada": "Vincent van Gogh's The Starry Night, post-impressionist oil painting, swirling night sky over a quiet village, bright crescent moon and stars, expressive brushstrokes, deep blues and vibrant yellows, museum masterpiece",
            
            "abaporu": "Tarsila do Amaral's Abaporu, Brazilian modernist painting from 1928, a surreal figure with a giant foot sitting by a cactus, warm colors, anthropophagic movement, Latin American art masterpiece",
            
            "guernica": "Pablo Picasso's Guernica, cubist black and white mural, chaotic scene of suffering from the Spanish Civil War, fragmented figures, horse and bull imagery, powerful anti-war artwork, Museum Reina Sofia",
            
            "girassois": "Van Gogh's Sunflowers, still life painting, yellow sunflowers in a vase, post-impressionist style, thick impasto brushstrokes, vibrant yellows against a blue background",
            
            "o grito": "Edvard Munch's The Scream, expressionist painting, figure screaming on a bridge with a dramatic sunset sky, swirling colors, intense emotion, Norwegian masterpiece",
            
            "persistencia da memoria": "Salvador Dali's The Persistence of Memory, surrealist painting, melting clocks in a desert landscape, dreamlike atmosphere, soft watches draped over branches, Dali's masterpiece",
            
            // Dinossauros realistas
            "tiranossauro rex": "A photorealistic Tyrannosaurus Rex, detailed scales, sharp teeth, powerful legs, small arms, prehistoric jungle background, Cretaceous period, scientific paleoart, dramatic lighting, ultra HD, cinematic quality",
            
            "triceratops": "A photorealistic Triceratops dinosaur, three horns, large frill, herbivorous, detailed skin texture, Cretaceous period, lush green prehistoric landscape, scientific accuracy, museum quality illustration",
            
            "braquiossauro": "A photorealistic Brachiosaurus, extremely long neck, feeding on treetops, massive size compared to surrounding ferns, Jurassic period, warm sunlight, scientific paleoart",
            
            "velociraptor": "A photorealistic Velociraptor, feathered, intelligent predator, detailed plumage, Cretaceous period, hunting stance, scientifically accurate, natural history illustration",
            
            // Artistas
            "picasso cubista": "A cubist portrait in Pablo Picasso's style, geometric shapes, fragmented faces, abstract forms, multiple perspectives, oil painting, early 20th century modern art, vibrant colors, masterpiece",
            
            "dali surrealista": "A surrealist landscape in Salvador Dali's style, melting clocks, dreamlike imagery, bizarre dreamscape, long shadows, hyper-realistic details in impossible scenes, Spanish surrealism",
            
            "monet impressionista": "An impressionist garden in Claude Monet's style, water lilies, Japanese bridge, blurred brushstrokes, soft colors, atmospheric lighting, dappled sunlight, Giverny garden, masterpiece",
            
            "van gogh pos impressionista": "A post-impressionist landscape in Van Gogh's style, swirling sky, bold colors, expressive brushstrokes, cypress trees, rolling hills, Provence landscape, emotional intensity",
            
            "frida kahlo": "A self-portrait in Frida Kahlo's style, Mexican folk art elements, unibrow, flowers in braided hair, colorful ribbons, symbolic animals, vibrant Tehuana dress, surrealist background",
            
            "portinari": "A Brazilian rural scene in Candido Portinari's style, retirantes or migrant workers, earthy tones, elongated figures, social realism, Brazilian modernism, expressive faces",
            
            // Mapas
            "mapa do brasil": "A detailed, colorful illustrated map of Brazil, showing all 26 states and the Federal District, five regions with different colors, Amazon rainforest, major cities like São Paulo and Rio de Janeiro, educational poster style, vibrant and clear, white background",
            
            "mapa do mundo": "A detailed illustrated world map, all seven continents with labels, countries distinguished by different colors, blue oceans, educational poster style, vibrant and clear, white background",
            
            // Lettering
            "lettering alfabeto": "Beautiful decorative alphabet lettering, A to Z letters, each letter is a work of art with floral or geometric decorations, calligraphy style, black and white outline for coloring book, professional illustration",
            
            // Paisagens
            "por do sol": "A dramatic sunset over the ocean, vibrant orange and purple sky, golden sun sinking into the horizon, waves reflecting the light, tropical beach, professional landscape photography, ultra HD, realistic",
            
            "floresta amazonica": "The Amazon rainforest in Brazil, dense green canopy, tropical trees, colorful parrots, river winding through the jungle, morning mist, National Geographic style photography, ultra HD, realistic"
        };
        
        // Mapear também para obras em português
        const mapaPortugues = {
            "monalisa": "mona lisa",
            "noite estrelada": "noite estrelada",
            "abaporu": "abaporu",
            "t-rex": "tiranossauro rex",
            "trex": "tiranossauro rex",
            "van gogh": "van gogh pos impressionista",
            "picasso": "picasso cubista",
            "dali": "dali surrealista",
            "frida": "frida kahlo",
            "portinari": "portinari"
        };
        
        let chave = tema;
        for (const [pt, en] of Object.entries(mapaPortugues)) {
            if (chave.includes(pt)) {
                chave = en;
                break;
            }
        }
        
        let promptFinal = promptsProfissionais[chave];
        
        if (!promptFinal) {
            // Se não encontrou mapeamento específico, cria um prompt genérico profissional
            promptFinal = `A beautiful, professional, high-resolution illustration of ${tema}, detailed, realistic, masterpiece quality, suitable for art education, vibrant colors, museum quality artwork`;
        }
        
        console.log("🎨 Gerando imagem com DALL-E:", promptFinal.substring(0, 100) + "...");
        
        // Chamar a API do OpenAI DALL-E 3 [citation:8]
        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiApiKey}`
            },
            body: JSON.stringify({
                model: "dall-e-3",
                prompt: promptFinal,
                n: 1,
                size: "1024x1024",
                quality: "hd",
                style: "vivid"
            })
        });
        
        if (!response.ok) {
            const erro = await response.json();
            console.error("Erro DALL-E:", erro);
            return null;
        }
        
        const data = await response.json();
        
        if (data.data && data.data[0] && data.data[0].url) {
            console.log("✅ Imagem gerada com sucesso!");
            return data.data[0].url;
        }
        
        return null;
        
    } catch (error) {
        console.error('Erro ao gerar imagem com OpenAI:', error);
        return null;
    }
}

function extrairTema(prompt) {
    let tema = prompt.toLowerCase();
    
    // Remove palavras comuns de comando
    tema = tema.replace(/desenhe|desenho|colorir|me|um|uma|para|de|a|o|e|por favor|crie|faça|gere|mostre|imagem|figura|ilustração|pintura|obra|arte/g, "");
    tema = tema.trim();
    
    if (!tema || tema.length < 2) {
        tema = "belo jardim com flores";
    }
    
    // Mapear variações comuns
    const mapeamentos = {
        "tiranossauro": "tiranossauro rex",
        "trex": "tiranossauro rex",
        "t-rex": "tiranossauro rex",
        "monalisa": "mona lisa",
        "noite estrelada": "noite estrelada",
        "abaporu": "abaporu",
        "guernica": "guernica",
        "girassois": "girassois",
        "o grito": "o grito",
        "mapa brasil": "mapa do brasil",
        "mapa mundo": "mapa do mundo",
        "lettering": "lettering alfabeto",
        "por do sol": "por do sol",
        "amazonia": "floresta amazonica"
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
        "mona lisa": "A Mona Lisa de Leonardo da Vinci tem o sorriso mais famoso do mundo! Vou gerar uma imagem linda dessa obra-prima para você! 🖼️",
        "noite estrelada": "Van Gogh pintou 'Noite Estrelada' em 1889. O céu parece se mover com as pinceladas em espiral! 🌟",
        "abaporu": "Abaporu significa 'homem que come gente' em tupi. Tarsila pintou essa obra icônica em 1928! 🇧🇷",
        "tiranossauro": "O Tiranossauro Rex era o maior predador do período Jurássico! Vou gerar uma imagem realista para você! 🦖",
        "picasso": "Picasso inventou o Cubismo! Ele desmontava os rostos em formas geométricas. Vou gerar uma imagem no estilo cubista! 🎭",
        "van gogh": "Van Gogh pintou mais de 2.000 obras! Suas pinceladas grossas e cores vibrantes são únicas! 🌻",
        "mapa brasil": "O Brasil tem 26 estados e 5 regiões! O mapa parece um coração. Vou gerar um mapa colorido para você! 🗺️",
        "lettering": "Lettering é desenhar letras bonitas! Vou gerar um alfabeto decorativo para você! ✏️"
    };
    
    for (const [key, resposta] of Object.entries(respostas)) {
        if (p.includes(key)) {
            return resposta;
        }
    }
    
    return "Sou o Candinho, especialista em Arte! 🎨\n\nVocê pode me pedir para mostrar obras famosas como Mona Lisa, Noite Estrelada, Abaporu, ou dinossauros realistas! O que você quer ver hoje?";
}
