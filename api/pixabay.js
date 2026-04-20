// api/pixabay.js
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q } = req.query;
  const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

  if (!PIXABAY_API_KEY) {
    return res.status(500).json({ error: 'Chave Pixabay não configurada.' });
  }
  if (!q) {
    return res.status(400).json({ error: 'Parâmetro "q" é obrigatório.' });
  }

  const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(q)}&image_type=illustration&safesearch=true&per_page=24`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.status(200).json(data.hits || []);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar imagens no Pixabay.' });
  }
}
