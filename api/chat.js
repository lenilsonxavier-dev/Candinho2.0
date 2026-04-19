export default async function handler(req, res) {
    // Configurar CORS
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

    // Resposta padrão (caso a API falhe)
    let resposta = "Sou o Candinho! Especialista em Arte. 🎨\n\n";
    resposta += "Você pode me perguntar sobre:\n";
    resposta += "• Artistas (Van Gogh, Tarsila, Picasso)\n";
    resposta += "• Desenhos para colorir (dinossauros, mapas)\n";
    resposta += "• Emoções (tristeza, ansiedade)\n";
    resposta += "• Danças brasileiras (frevo, maracatu)\n\n";
    resposta += "Que tal me perguntar algo?";

    try {
        const apiKey = process.env.GROQ_API_KEY;
        
        if (apiKey && apiKey.startsWith('gsk_')) {
            const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "llama3-8b-8192",
                    messages: [
                        {
                            role: "system",
                            content: `Você é o Candinho, professor de arte de 60 anos.
- Fale de forma educativa e divertida
- Trate a criança como "você" ou "criança"
- NUNCA use "meu jovem", "meu amigo", "querido"
- Responda sobre arte, artistas, dinossauros, mapas, emoções
- Respostas curtas (2-4 frases)`
                        },
                        { role: "user", content: message }
                    ],
                    max_tokens: 150,
                    temperature: 0.7
                })
            });
            
            if (groqResponse.ok) {
                const data = await groqResponse.json();
                if (data.choices && data.choices[0] && data.choices[0].message) {
                    resposta = data.choices[0].message.content;
                    resposta = resposta.replace(/meu jovem|meu amigo|querido|meu caro/gi, '');
                }
            }
        }
        
        // Gerar imagem se solicitado
        let imagemUrl = null;
        if (gerarImagem) {
            let tema = message.toLowerCase();
            tema = tema.replace(/desenhe|desenho|colorir|me|um|uma|para|de|a|o|e/g, "").trim();
            
            if (!tema || tema.length < 2) tema = "feliz";
            
            if (tema.includes("dinossauro")) tema = "cute dinosaur outline coloring page";
            else if (tema.includes("mapa")) tema = "simple map outline coloring page";
            else tema = `simple ${tema} outline drawing coloring page`;
            
            imagemUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(tema)}?width=512&height=512&nologo=true`;
        }
        
        return res.status(200).json({
            resposta: resposta,
            imagem: imagemUrl
        });
        
    } catch (error) {
        console.error('Erro:', error);
        return res.status(200).json({
            resposta: "Sou o Candinho! Especialista em Arte. Me pergunte sobre Van Gogh, Tarsila ou peça um desenho! 🎨",
            imagem: null
        });
    }
}
