// api/pixabay.js
export default async function handler(req, res) {
  const { q } = req.query;
  const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

  if (!PIXABAY_API_KEY) {
    return res.status(500).json({ error: 'Chave da API Pixabay não configurada.' });
  }

  if (!q) {
    return res.status(400).json({ error: 'Parâmetro "q" (busca) é obrigatório.' });
  }

  const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(q)}&image_type=illustration&safesearch=true&per_page=24`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.hits) {
      res.status(200).json(data.hits);
    } else {
      res.status(500).json({ error: 'Erro ao buscar imagens no Pixabay.' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Erro na comunicação com o Pixabay.' });
  }
}
