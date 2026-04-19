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
            return res.status(500).json({ 
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
                        content: `Você é o Candinho, professor de arte de 60 anos.
- Fale com a criança de forma educativa e lúdica
- Use "você" ou "criança" - NUNCA use "meu jovem", "meu amigo"
- Responda sobre arte, artistas, dinossauros, mapas
- Respostas curtas (2-3 frases)`
                    },
                    { role: "user", content: pergunta }
                ],
                max_tokens: 150,
                temperature: 0.7
            })
        });
        
        const data = await response.json();
        
        if (data.choices && data.choices[0] && data.choices[0].message) {
            return data.choices[0].message.content;
        }
        
        return "Que pergunta legal! Vamos aprender mais sobre arte? 🎨";
        
    } catch (error) {
        return "Vamos conversar sobre arte? Pode me perguntar o que quiser! 🎨";
    }
}

async function gerarImagemParaColorir(prompt) {
    try {
        let tema = prompt.toLowerCase();
        tema = tema.replace(/desenhe|desenho|colorir|me|um|uma|para|de|a|o|e/g, "").trim();
        
        if (tema.includes("dinossauro")) tema = "cute dinosaur outline coloring page";
        else if (tema.includes("mapa") && tema.includes("brasil")) tema = "map of Brazil outline coloring page";
        else if (tema.includes("mona")) tema = "Mona Lisa outline coloring page";
        else tema = `simple ${tema} outline drawing coloring page for kids`;
        
        const encodedPrompt = encodeURIComponent(tema);
        return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true`;
        
    } catch (error) {
        return null;
    }
}
