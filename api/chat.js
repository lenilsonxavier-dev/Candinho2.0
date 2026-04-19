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
        
        // Detectar o que o usuário quer desenhar
        let tema = "";
        let tipo = "desenho";
        
        // Extrair o tema principal
        if (textoOriginal.includes("desenhe") || textoOriginal.includes("desenho")) {
            // Pegar o que vem depois de "desenhe"
            let match = textoOriginal.match(/(?:desenhe|desenho|desenha|faca um|crie um)\s+(.+)/i);
            if (match) {
                tema = match[1];
            } else {
                tema = textoOriginal.replace(/desenhe|desenho|desenha|colorir|me|um|uma|para|de|a|o|e|por favor/g, "").trim();
            }
        } else {
            tema = textoOriginal.replace(/desenhe|desenho|colorir|me|um|uma|para|de|a|o|e/g, "").trim();
        }
        
        if (!tema || tema.length < 2) {
            tema = "coisa feliz";
        }
        
        // Mapeamento preciso de temas
        const mapeamento = {
            // Dinossauros
            "tiranossauro": "Tyrannosaurus Rex dinosaur, outline drawing, coloring page for kids, cute, simple lines",
            "tiranossauro rex": "Tyrannosaurus Rex dinosaur, outline drawing, coloring page for kids, cute, simple lines",
            "t-rex": "Tyrannosaurus Rex dinosaur, outline drawing, coloring page for kids, cute, simple lines",
            "triceratops": "Triceratops dinosaur with three horns, outline drawing, coloring page for kids, simple lines",
            "braquiossauro": "Brachiosaurus long neck dinosaur, outline drawing, coloring page for kids",
            "velociraptor": "Velociraptor dinosaur, outline drawing, coloring page for kids, cute",
            "dinossauro": "cute baby dinosaur, outline drawing, coloring page for kids, simple lines",
            
            // Obras de arte famosas
            "mona lisa": "Mona Lisa painting by Leonardo da Vinci, simple outline drawing, coloring page",
            "noite estrelada": "Starry Night by Van Gogh, simplified outline, coloring page for kids",
            "abaporu": "Abaporu painting by Tarsila do Amaral, simplified outline drawing",
            "guernica": "Guernica by Picasso, simplified outline, coloring page",
            "girassois": "Sunflowers by Van Gogh, outline drawing, coloring page",
            
            // Artistas
            "picasso": "cubist face drawing by Picasso style, simple outline, coloring page for kids",
            "van gogh": "Van Gogh style landscape with swirling sky, outline drawing, coloring page",
            "portinari": "Brazilian children playing, Portinari style, outline drawing, coloring page",
            "tarsila": "Brazilian landscape with cactus, Tarsila style, outline drawing, coloring page",
            
            // Animais
            "gato": "cute cat sitting, outline drawing, coloring page for kids, simple lines",
            "cachorro": "cute dog standing, outline drawing, coloring page for kids, simple lines",
            "leao": "lion face, outline drawing, coloring page for kids, simple lines",
            "elefante": "cute elephant, outline drawing, coloring page for kids, simple lines",
            "macaco": "cute monkey hanging from tree, outline drawing, coloring page",
            "passaro": "bird sitting on branch, outline drawing, coloring page for kids",
            "borboleta": "butterfly with patterns, outline drawing, coloring page for kids",
            
            // Natureza
            "flor": "simple flower with petals and stem, outline drawing, coloring page for kids",
            "flores": "bouquet of flowers, outline drawing, coloring page for kids",
            "arvore": "tree with leaves and trunk, outline drawing, coloring page for kids",
            "sol": "sun with rays, outline drawing, coloring page for kids",
            "nuvem": "cloud, outline drawing, coloring page for kids",
            
            // Mapas
            "mapa brasil": "map of Brazil with states outline, coloring page for kids",
            "mapa do brasil": "map of Brazil with states outline, coloring page for kids",
            "mapa mundo": "world map with continents outline, coloring page for kids",
            
            // Lettering
            "lettering": "alphabet letters A B C decorative, outline drawing, coloring page",
            "letras": "decorative letters, alphabet, outline drawing, coloring page for kids",
            
            // Outros
            "castelo": "castle with towers, outline drawing, coloring page for kids",
            "casa": "simple house, outline drawing, coloring page for kids",
            "carro": "simple car, outline drawing, coloring page for kids",
            "boneca": "simple doll, outline drawing, coloring page for kids",
            "bola": "ball, outline drawing, coloring page for kids",
            "estrela": "star shape, outline drawing, coloring page for kids",
            "coracao": "heart shape, outline drawing, coloring page for kids"
        };
        
        // Verificar se o tema está no mapeamento
        let promptImagem = null;
        for (const [key, valor] of Object.entries(mapeamento)) {
            if (tema.includes(key)) {
                promptImagem = valor;
                break;
            }
        }
        
        // Se não encontrou, criar um prompt genérico
        if (!promptImagem) {
            // Limpar o tema de palavras indesejadas
            tema = tema.replace(/para colorir|por favor|me|um|uma|o|a|de|em|com/g, "").trim();
            promptImagem = `simple ${tema} outline drawing, coloring page for kids, black and white, thick clear lines, white background, cute, child friendly`;
        }
        
        console.log("Gerando imagem com prompt:", promptImagem);
        
        // Usar API do Pollinations com prompt melhorado
        const encodedPrompt = encodeURIComponent(promptImagem);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true&model=flux`;
        
        return imageUrl;
        
    } catch (error) {
        console.error('Erro ao gerar imagem:', error);
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
