export default async function handler(req, res) {
    // Permitir CORS
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
        // Buscar a chave do ambiente Vercel
        const apiKey = process.env.GROQ_API_KEY;
        
        if (!apiKey) {
            console.error('GROQ_API_KEY não configurada');
            return res.status(500).json({ 
                error: 'API não configurada. Configure a variável GROQ_API_KEY no Vercel.' 
            });
        }
        
        // 1. Gerar resposta da IA
        let respostaIA = await getRespostaIA(message, apiKey);
        
        // 2. Gerar imagem se solicitado
        let imagemUrl = null;
        if (gerarImagem) {
            imagemUrl = await gerarImagemParaColorir(message);
        }
        
        res.status(200).json({
            resposta: respostaIA,
            imagem: imagemUrl
        });
        
    } catch (error) {
        console.error('Erro detalhado:', error);
        res.status(500).json({ 
            error: 'Erro ao processar requisição',
            details: error.message 
        });
    }
}

async function getRespostaIA(pergunta, apiKey) {
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "mixtral-8x7b-32768",
                messages: [
                    {
                        role: "system",
                        content: `Você é o Candinho, um professor de arte de 60 anos.
- Fale português do Brasil de forma lúdica e educativa
- Trate a criança como "você" ou "criança"
- Use diminutivos: desenhozinho, pinturinha, coleguinha
- NUNCA use "meu jovem", "meu amigo", "querido"
- Ensina sobre arte, artistas, dinossauros, mapas, lettering, emoções
- Respostas curtas (2-4 frases)
- Se pedirem desenho, diga que vai gerar uma imagem
- NUNCA fale sobre violência, política ou assuntos adultos`
                    },
                    { role: "user", content: pergunta }
                ],
                max_tokens: 200,
                temperature: 0.8
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Erro Groq:', errorText);
            return "Desculpe, tive um probleminha técnico. Vamos tentar de novo? 🎨";
        }
        
        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('Resposta inesperada:', data);
            return "Recebi uma resposta estranha. Vamos tentar de novo? 🎨";
        }
        
        let resposta = data.choices[0].message.content;
        // Remover possíveis clichês
        resposta = resposta.replace(/meu jovem|meu amigo|querido|meu caro/gi, '');
        return resposta.trim();
        
    } catch (error) {
        console.error('Erro na chamada Groq:', error);
        return "Ops! Minha tinta acabou por um momento. Pode repetir a pergunta? 🎨";
    }
}

async function gerarImagemParaColorir(prompt) {
    try {
        // Melhorar o prompt para desenhos mais precisos
        let tema = prompt.toLowerCase();
        tema = tema.replace(/desenhe|desenho|colorir|me|um|uma|para|de|a|o|e|por favor/g, "").trim();
        
        if (!tema || tema.length < 2) tema = "coisa feliz";
        
        // Mapear temas específicos para melhor resultado
        if (tema.includes("mapa") && tema.includes("brasil")) {
            tema = "map of Brazil with all 26 states and Federal District, outline, coloring page for kids, simple lines";
        } else if (tema.includes("mapa") && tema.includes("mundo")) {
            tema = "world map with continents, outline, coloring page for kids, simple lines";
        } else if (tema.includes("dinossauro") && tema.includes("tiranossauro")) {
            tema = "Tyrannosaurus Rex dinosaur, outline drawing, coloring page for kids, simple lines, cute";
        } else if (tema.includes("dinossauro")) {
            tema = "cute dinosaur, outline drawing, coloring page for kids, simple lines, triceratops or brachiosaurus";
        } else if (tema.includes("lettering")) {
            tema = "alphabet lettering, decorative letters A to Z, outline, coloring page for kids";
        } else if (tema.includes("mona lisa")) {
            tema = "Mona Lisa painting outline, simple lines, coloring page for kids";
        } else if (tema.includes("noite estrelada")) {
            tema = "Starry Night by Van Gogh, simplified outline, coloring page for kids";
        } else if (tema.includes("abaporu")) {
            tema = "Abaporu painting by Tarsila do Amaral, simplified outline, coloring page";
        } else if (tema.includes("gato")) {
            tema = "cute cat, outline drawing, coloring page for kids, simple lines";
        } else if (tema.includes("cachorro")) {
            tema = "cute dog, outline drawing, coloring page for kids, simple lines";
        } else {
            tema = `black and white outline drawing, coloring page for kids, simple line art, ${tema}, thick clear lines, white background, cute, child friendly`;
        }
        
        const encodedPrompt = encodeURIComponent(tema);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true`;
        
        console.log("Gerando imagem para:", tema);
        return imageUrl;
        
    } catch (error) {
        console.error('Erro ao gerar imagem:', error);
        return null;
    }
}
