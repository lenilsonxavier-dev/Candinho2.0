// api/groq.js
import fs from 'fs';
import path from 'path';

// ======================= FUNÇÃO PARA LER JSONs =======================
function lerJSON(nomeArquivo) {
  try {
    const caminho = path.join(process.cwd(), 'api', 'data', nomeArquivo);
    const conteudo = fs.readFileSync(caminho, 'utf-8');
    return JSON.parse(conteudo);
  } catch (err) {
    console.error(`Erro ao ler ${nomeArquivo}:`, err);
    return {};
  }
}

// Carregar todos os JSONs uma única vez (cache)
let cache = {};
function carregarJSONs() {
  if (Object.keys(cache).length > 0) return cache;
  
  cache = {
    dancas: lerJSON('dancas.json'),
    artes: lerJSON('artes_visuais.json'),
    artistas: lerJSON('artistas.json'),
    historia: lerJSON('historia_arte.json'),
    teatro: lerJSON('teatro.json'),
    musica: lerJSON('musica.json'),
    folclore: lerJSON('folclore.json'),
    ritmos: lerJSON('ritmos_musicais.json'),
    festas: lerJSON('festas_brasileiras.json'),
    lugares: lerJSON('lugares_arte.json'),
    curiosidades: lerJSON('curiosidades.json'),
    indigena: lerJSON('cultura_indigena.json'),
    afro: lerJSON('cultura_afro_brasileira.json'),
    atividades: lerJSON('atividades_artisticas.json'),
    emocional: lerJSON('apoio_emocional.json'),
    piadas: lerJSON('piadas.json')
  };
  return cache;
}

// ======================= RESPOSTAS INSTANTÂNEAS =======================
function pegarAleatorio(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const valores = Object.values(obj);
  if (valores.length === 0) return null;
  const item = valores[Math.floor(Math.random() * valores.length)];
  if (typeof item === 'object' && item.explicacao_infantil) return item.explicacao_infantil;
  return String(item);
}

function respostaInstantanea(pergunta, data) {
  const texto = pergunta.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (texto.includes('piada')) return pegarAleatorio(data.piadas);
  if (texto.includes('curiosidade')) return pegarAleatorio(data.curiosidades);
  if (texto.includes('atividade') || texto.includes('brincadeira')) return pegarAleatorio(data.atividades);
  if (texto.includes('artista') || texto.includes('pintor')) return pegarAleatorio(data.artistas);
  if (texto.includes('danca') || texto.includes('dança')) return pegarAleatorio(data.dancas);
  if (texto.includes('historia') || texto.includes('história')) return pegarAleatorio(data.historia);
  return null;
}

function buscarContexto(pergunta, data) {
  const texto = pergunta.toLowerCase();
  const bases = [
    data.dancas, data.artes, data.artistas, data.historia,
    data.teatro, data.musica, data.indigena, data.afro,
    data.folclore, data.ritmos, data.lugares, data.festas,
    data.atividades, data.emocional, data.curiosidades
  ];
  for (const base of bases) {
    if (!base) continue;
    for (const chave in base) {
      if (texto.includes(chave.replace(/_/g, ' '))) {
        return base[chave].explicacao_infantil || '';
      }
    }
  }
  return '';
}

// ======================= HANDLER PRINCIPAL =======================
export default async function handler(req, res) {
  // Garantir que só aceita POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  try {
    const { mensagem } = req.body;
    if (!mensagem || typeof mensagem !== 'string') {
      return res.status(400).json({ error: 'Mensagem inválida.' });
    }

    // Carregar JSONs
    const data = carregarJSONs();

    // 1. Resposta instantânea
    const instant = respostaInstantanea(mensagem, data);
    if (instant) {
      return res.status(200).json({ reply: instant });
    }

    // 2. Buscar contexto
    let contexto = buscarContexto(mensagem, data);
    if (!contexto) contexto = 'Explique de forma educativa e simples para uma criança de 10 anos.';

    // 3. Chamar Groq
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      console.error('GROQ_API_KEY não configurada');
      return res.status(500).json({ error: 'Chave da API não configurada no servidor.' });
    }

    const systemPrompt = `Você é Candinho, professor de arte de 60 anos, gentil e paciente.
- Fale frases curtas (máximo 3 linhas) para crianças de 10 anos.
- Responda em português do Brasil com carinho.
- Use linguagem simples, incentive a criatividade.`;

    const userPrompt = `Contexto: ${contexto.slice(0, 300)}\n\nPergunta: ${mensagem}\n\nCandinho:`;

    const payload = {
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 120,
      stream: false
    };

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Groq API ${response.status}:`, errorText);
      throw new Error(`Groq respondeu com ${response.status}`);
    }

    const groqData = await response.json();
    const reply = groqData.choices?.[0]?.message?.content?.trim() || 
                  'Hum, não consegui responder agora. Tente de novo? 🎨';

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Erro no handler:', err);
    return res.status(500).json({ 
      error: 'Erro interno no servidor',
      details: err.message 
    });
  }
}
