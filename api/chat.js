// scripts/seedPixabay.js
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

// PIXABAY_API_KEY = 'sua_chave_aqui'
// DATABASE_URL = 'postgresql://...'
// BLOB_READ_WRITE_TOKEN = 'seu_token_blob'

const sql = neon(process.env.DATABASE_URL);

const categorias = [
  { nome: "animais", termos: ["cachorro", "gato", "leão"] },
  { nome: "insetos", termos: ["borboleta", "abelha"] },
  { nome: "mapas", termos: ["mapa brasil", "mapa mundi"] },
  { nome: "contos", termos: ["castelo", "dragão", "unicórnio"] },
  { nome: "obras de arte", termos: ["mona lisa desenho", "van gogh noite estrelada"] },
  { nome: "animes", termos: ["goku dragon ball", "naruto"] },
  { nome: "herois", termos: ["batman", "superman"] },
  { nome: "games", termos: ["sonic", "mario yoshi"] },
  { nome: "cidades", termos: ["torre eiffel paris", "cristo redentor rio"] }
];

async function buscarImagemPixabay(termo) {
  const url = `https://pixabay.com/api/?key=${process.env.PIXABAY_API_KEY}&q=${encodeURIComponent(termo)}&image_type=illustration&safesearch=true&per_page=3`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.hits && data.hits.length > 0) {
    // Retorna a URL da maior imagem disponível (para qualidade)
    return data.hits[0].largeImageURL || data.hits[0].webformatURL;
  }
  return null;
}

async function seed() {
  for (const cat of categorias) {
    for (const termo of cat.termos) {
      console.log(`🔍 Buscando: ${termo} (${cat.nome})`);
      const imageUrl = await buscarImagemPixabay(termo);
      if (imageUrl) {
        // Salva a URL da imagem diretamente no banco de dados
        await sql`
          INSERT INTO images (title, category, image_url)
          VALUES (${termo}, ${cat.nome}, ${imageUrl})
        `;
        console.log(`✅ Salvo: ${termo}`);
      } else {
        console.log(`❌ Nada encontrado para: ${termo}`);
      }
      // Aguarda 1 segundo para não sobrecarregar a API
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  console.log('🎉 Seed concluído!');
}

seed();
