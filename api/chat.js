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
        
        // Tenta usar a Groq se tiver chave
        let respostaIA = null;
        
        if (apiKey && apiKey.startsWith('gsk_')) {
            respostaIA = await getRespostaGroq(message, apiKey);
        }
        
        // Se a Groq falhar, usa fallback inteligente
        if (!respostaIA) {
            respostaIA = getRespostaFallback(message);
        }
        
        // Gerar imagem se solicitado
        let imagemUrl = null;
        if (gerarImagem) {
            imagemUrl = await gerarImagemParaColorir(message);
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
        // Lista de modelos que funcionam no Groq
        const modelos = [
            "llama-3.1-8b-instant",
            "llama3-8b-8192", 
            "mixtral-8x7b-32768"
        ];
        
        for (const modelo of modelos) {
            try {
                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: modelo,
                        messages: [
                            {
                                role: "system",
                                content: `Você é o Candinho, professor de arte de 60 anos.
- Fale de forma educativa, lúdica e acolhedora
- Use "você" ou "criança" - NUNCA use "meu jovem", "meu amigo", "querido"
- Responda sobre arte, artistas, dinossauros, mapas, lettering, danças brasileiras, emoções
- Respostas de 2-4 frases, diretas e com emojis
- Se não souber algo, diga que vai pesquisar
- NUNCA fale sobre violência ou assuntos adultos`
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
            } catch (err) {
                console.log(`Modelo ${modelo} falhou:`, err.message);
                continue;
            }
        }
        
        return null;
        
    } catch (error) {
        console.error('Erro Groq:', error);
        return null;
    }
}

function getRespostaFallback(pergunta) {
    const p = pergunta.toLowerCase();
    
    // Fallback rico com conhecimento variado
    const respostas = {
        "van gogh": "Van Gogh pintou 'Noite Estrelada'! Ele usava pinceladas grossas e cores vibrantes. Vamos tentar pintar um céu estrelado? 🌟",
        "monet": "Monet criou o Impressionismo! Pintava a mesma cena em diferentes horários para mostrar a luz. 🌅",
        "picasso": "Picasso inventou o Cubismo! Desmontava rostos em formas geométricas. Tente desenhar um rosto com quadrados! 🎭",
        "tarsila": "Tarsila pintou 'Abaporu' e é a artista brasileira mais importante do modernismo! 🇧🇷",
        "portinari": "Portinari pintou a vida do povo brasileiro: retirantes, café e crianças brincando. ☕",
        "frida": "Frida Kahlo transformou sua dor em arte! Pintava autorretratos cheios de cores mexicanas. 🌺",
        "dinossauro": "Dinossauros viveram há milhões de anos! Tiranossauro, Triceratops e Braquiossauro são os mais famosos! 🦖",
        "mapa brasil": "O Brasil tem 26 estados e 5 regiões! O mapa parece um coração. Vamos colorir? 🗺️",
        "lettering": "Lettering é desenhar letras bonitas! Dá para fazer letras gordinhas, fininhas, com sombra... ✏️",
        "mona lisa": "A Mona Lisa tem o sorriso mais famoso do mundo! Está no Louvre em Paris. 🖼️",
        "frevo": "O Frevo é dança pernambucana com guarda-chuvas coloridos e passos acrobáticos! ☂️",
        "maracatu": "Maracatu é dança teatral com roupas brilhantes e bonecos gigantes! 👑",
        "triste": "Desenhar a tristeza ajuda ela a ir embora! Use cores alegres depois para espantar. 🌈",
        "ansiedade": "Respire fundo e desenhe bem devagar. Mandalas ajudam a acalmar a mente! 🧘",
        "bullying": "Converse com um adulto. Você é especial como uma obra de arte única! 🛡️"
    };
    
    for (const [key, resposta] of Object.entries(respostas)) {
        if (p.includes(key)) {
            return resposta;
        }
    }
    
    return "Sou o Candinho, especialista em Arte! 🎨\n\n" +
           "Posso te ensinar sobre:\n" +
           "• Artistas (Van Gogh, Tarsila, Picasso, Frida)\n" +
           "• Dinossauros (Tiranossauro, Triceratops)\n" +
           "• Mapas do Brasil e do mundo\n" +
           "• Lettering (letras bonitas)\n" +
           "• Danças brasileiras (Frevo, Maracatu)\n" +
           "• Obras famosas (Mona Lisa, Noite Estrelada)\n" +
           "• Emoções (tristeza, ansiedade, bullying)\n\n" +
           "O que você quer aprender hoje?";
}

async function gerarImagemParaColorir(prompt) {
    try {
        let tema = prompt.toLowerCase();
        tema = tema.replace(/desenhe|desenho|colorir|me|um|uma|para|de|a|o|e/g, "").trim();
        
        if (!tema || tema.length < 2) tema = "coisa feliz";
        
        const temasEspeciais = {
            "dinossauro": "cute baby dinosaur outline coloring page",
            "tiranossauro": "tyrannosaurus rex outline coloring page cute",
            "mapa brasil": "map of Brazil with states outline coloring page",
            "mona lisa": "Mona Lisa outline drawing coloring page",
            "gato": "cute cat outline drawing coloring page",
            "cachorro": "cute dog outline drawing coloring page",
            "unicornio": "cute unicorn outline coloring page",
            "castelo": "castle outline drawing coloring page"
        };
        
        for (const [key, valor] of Object.entries(temasEspeciais)) {
            if (tema.includes(key)) {
                tema = valor;
                break;
            }
        }
        
        if (!tema.includes("outline")) {
            tema = `simple ${tema} outline drawing coloring page for kids black and white`;
        }
        
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(tema)}?width=512&height=512&nologo=true`;
        return imageUrl;
        
    } catch (error) {
        return null;
    }
}
