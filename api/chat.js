export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    const { message, gerarImagem } = req.body;
    
    if (!message) {
        return res.status(400).json({ error: 'Mensagem não fornecida' });
    }

    try {
        const apiKey = process.env.GROQ_API_KEY;
        
        if (!apiKey) {
            return res.status(200).json({ 
                resposta: "Não consegui conectar com a nuvem. Vamos tentar de novo? 🎨"
            });
        }
        
        // Resposta da IA
        let respostaIA = await getRespostaIA(message, apiKey);
        
        // Imagem se solicitado
        let imagemUrl = null;
        if (gerarImagem) {
            imagemUrl = await gerarImagemParaColorir(message);
        }
        
        res.status(200).json({
            resposta: respostaIA,
            imagem: imagemUrl
        });
        
    } catch (error) {
        console.error('Erro:', error);
        res.status(200).json({ 
            resposta: "Tive um probleminha. Pode repetir? 🎨"
        });
    }
}

async function getRespostaIA(pergunta, apiKey) {
    try {
        // Modelo correto do Groq - usando llama3 que funciona
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "llama3-8b-8192",  // Modelo mais estável do Groq
                messages: [
                    {
                        role: "system",
                        content: `Você é o Candinho, professor de arte de 60 anos.
Fale com a criança de forma educativa e divertida.
Use "você" ou "criança" - NUNCA use "meu jovem", "meu amigo".
Responda sobre arte, artistas, dinossauros, mapas, emoções.
Respostas curtas (2-3 frases).
Seja acolhedor e use emojis 🎨😊`
                    },
                    {
                        role: "user",
                        content: pergunta
                    }
                ],
                max_tokens: 150,
                temperature: 0.7
            })
        });
        
        const data = await response.json();
        
        // Log para debug
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(data));
        
        if (response.ok && data.choices && data.choices[0] && data.choices[0].message) {
            let resposta = data.choices[0].message.content;
            // Limpar clichês
            resposta = resposta.replace(/meu jovem|meu amigo|querido|meu caro/gi, '');
            return resposta.trim();
        }
        
        // Se falhar, retornar mensagem amigável
        if (data.error) {
            console.error('Erro Groq:', data.error);
            return "Vamos conversar sobre arte? Me pergunte sobre Van Gogh, Tarsila ou peça um desenho! 🎨";
        }
        
        return "Que pergunta legal! Quer saber mais sobre arte? 🎨";
        
    } catch (error) {
        console.error('Erro na chamada:', error);
        return "Oi! Pode me perguntar sobre arte ou pedir um desenho para colorir! 🎨";
    }
}

async function gerarImagemParaColorir(prompt) {
    try {
        let tema = prompt.toLowerCase();
        tema = tema.replace(/desenhe|desenho|colorir|me|um|uma|para|de|a|o|e|por favor/g, "").trim();
        
        if (!tema || tema.length < 2) {
            tema = "coisa feliz";
        }
        
        // Melhorar os temas
        if (tema.includes("dinossauro")) {
            tema = "cute baby dinosaur, outline drawing, coloring page for kids";
        } else if (tema.includes("mapa") && tema.includes("brasil")) {
            tema = "map of Brazil with states, outline, coloring page for kids";
        } else if (tema.includes("mona")) {
            tema = "Mona Lisa painting, simple outline, coloring page for kids";
        } else if (tema.includes("gato")) {
            tema = "cute cat, outline drawing, coloring page for kids";
        } else if (tema.includes("cachorro")) {
            tema = "cute dog, outline drawing, coloring page for kids";
        } else {
            tema = `simple ${tema} outline drawing, coloring page for kids, black and white`;
        }
        
        const encodedPrompt = encodeURIComponent(tema);
        return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true`;
        
    } catch (error) {
        console.error('Erro imagem:', error);
        return null;
    }
}
