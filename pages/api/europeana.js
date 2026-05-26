// ========================================
// API ROUTE PARA EUROPEANA (Vercel)
// ========================================

// A chave será configurada nas Environment Variables da Vercel
const EUROPEANA_API_KEY = process.env.EUROPEANA_API_KEY;

export default async function handler(req, res) {
    // Permitir apenas POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
        const { termo, tipo = 'artista' } = req.body;

        if (!termo) {
            return res.status(400).json({ error: 'Termo de busca é obrigatório' });
        }

        // Verifica se a chave está configurada
        if (!EUROPEANA_API_KEY || EUROPEANA_API_KEY === '') {
            console.warn('⚠️ Chave da Europeana não configurada');
            return res.status(200).json({ 
                error: 'Chave não configurada',
                reply: '🔧 A chave da Europeana ainda não foi configurada. Adicione EUROPEANA_API_KEY nas variáveis de ambiente da Vercel.'
            });
        }

        // Busca na Europeana
        const resultados = await buscarNaEuropeana(termo, tipo);
        
        return res.status(200).json(resultados);

    } catch (error) {
        console.error('Erro na API Europeana:', error);
        return res.status(500).json({ 
            error: 'Erro interno',
            reply: 'Desculpe, tive um problema ao buscar informações. Tente novamente! 🎨'
        });
    }
}

async function buscarNaEuropeana(termo, tipo) {
    let query = '';
    
    // Monta a query baseado no tipo de busca
    if (tipo === 'artista') {
        query = `who:"${encodeURIComponent(termo)}"`;
    } else if (tipo === 'obra') {
        query = `title:"${encodeURIComponent(termo)}"`;
    } else {
        query = encodeURIComponent(termo);
    }
    
    const url = `https://api.europeana.eu/record/v2/search.json?wskey=${EUROPEANA_API_KEY}&query=${query}&qf=type:IMAGE&rows=5`;
    
    console.log('🔍 Buscando:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
        return {
            encontrado: false,
            reply: `Não encontrei obras de "${termo}" na Europeana. Que tal tentar outro artista? 🎨`
        };
    }
    
    // Processa os resultados
    const obras = data.items.map(item => ({
        titulo: item.title?.[0] || 'Título desconhecido',
        imagem: item.edmPreview?.[0] || null,
        credito: item.dataProvider?.[0] || 'Europeana',
        ano: item.year?.[0] || 'Ano desconhecido',
        link: item.guid || null
    }));
    
    const primeiraObra = obras.find(o => o.imagem);
    
    return {
        encontrado: true,
        reply: `🎨 Encontrei obras de "${termo}" na Europeana!`,
        obra: primeiraObra,
        obras: obras.filter(o => o.imagem).slice(0, 3)
    };
}
