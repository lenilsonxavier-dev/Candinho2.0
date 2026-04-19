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
                model: "mixtral-8x7b-32768", // Modelo gratuito do Groq
                messages: [
                    {
                        role: "system",
                        content: `Você é o Candinho, um professor de arte muito querido de 60 anos.
- Fala português do Brasil de forma clara e educativa
- Ensina crianças de 10 anos sobre arte, pintura, artistas famosos e cultura
- É paciente, divertido e usa emojis 🎨😊✨
- Respostas curtas (máximo 3-4 frases)
- Se pedirem um desenho, diga que vai gerar uma imagem para colorir
- NUNCA fala sobre violência, política ou assuntos adultos`
                    },
                    { role: "user", content: pergunta }
                ],
                max_tokens: 150,
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Erro Groq:', errorText);
            return "Desculpe, tive um probleminha técnico. Vamos tentar de novo? 🎨";
        }
        
        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('Resposta inesperada da Groq:', data);
            return "Recebi uma resposta estranha da IA. Vamos tentar de novo? 🎨";
        }
        
        return data.choices[0].message.content;
        
    } catch (error) {
        console.error('Erro na chamada Groq:', error);
        return "Ops! Minha tinta acabou por um momento. Pode repetir a pergunta? 🎨";
    }
}

async function gerarImagemParaColorir(prompt) {
    try {
        // Usando Pollinations (grátis, sem chave necessária)
        const promptFormatado = `black and white outline drawing, coloring page for kids, simple line art, ${prompt}, thick clear lines, no shading, white background, child friendly`;
        const encodedPrompt = encodeURIComponent(promptFormatado);
        return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true`;
    } catch (error) {
        console.error('Erro ao gerar imagem:', error);
        return null;
    }
}
