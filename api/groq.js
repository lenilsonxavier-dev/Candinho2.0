// ==================== BUSCA EM ACERVOS BRASILEIROS ====================
// Via Meta-Acervos/Wikimedia GLAM

const MUSEUS_BRASILEIROS = {
    masp: "MASP",
    pinacoteca: "Pinacoteca de São Paulo",
    belas_artes: "Museu Nacional de Belas Artes",
    museu_paulista: "Museu Paulista da USP",
    mac_usp: "MAC-USP"
};

// Mapeamento de instituições no Wikidata
const INSTITUICOES_WIKIDATA = {
    "MASP": "Q1299767",
    "Pinacoteca de São Paulo": "Q10350353",
    "Museu Nacional de Belas Artes": "Q2094726",
    "Museu Paulista da USP": "Q3693239",
    "MAC-USP": "Q10321431"
};

async function buscarAcervoBrasileiro(termo, museuEspecifico = null) {
    try {
        // Constrói a query SPARQL para buscar obras de museus brasileiros
        let instituicoesQuery = "";
        
        if (museuEspecifico && INSTITUICOES_WIKIDATA[museuEspecifico]) {
            // Busca em um museu específico
            const wikidataId = INSTITUICOES_WIKIDATA[museuEspecifico];
            instituicoesQuery = `?item wdt:P195 wd:${wikidataId} .`;
        } else {
            // Busca em todos os museus brasileiros mapeados
            const ids = Object.values(INSTITUICOES_WIKIDATA);
            const options = ids.map(id => `wd:${id}`).join(" ");
            instituicoesQuery = `?item wdt:P195 (${options}) .`;
        }
        
        // Query SPARQL para buscar obras com imagem
        const sparqlQuery = `
            SELECT ?item ?itemLabel ?image ?creatorLabel ?inception ?collectionLabel WHERE {
                ?item wdt:P31 wd:Q3305213 .  # é uma pintura
                ${instituicoesQuery}
                ?item wdt:P18 ?image .        # tem imagem
                
                OPTIONAL { ?item wdt:P170 ?creator . }
                OPTIONAL { ?item wdt:P571 ?inception . }
                OPTIONAL { ?item wdt:P195 ?collection . }
                
                SERVICE wikibase:label { 
                    bd:serviceParam wikibase:language "pt,en" .
                    ?item rdfs:label ?itemLabel .
                    ?creator rdfs:label ?creatorLabel .
                    ?collection rdfs:label ?collectionLabel .
                }
            }
            LIMIT 20
        `;
        
        // Se tem termo de busca, adiciona filtro de texto
        let finalQuery = sparqlQuery;
        if (termo) {
            finalQuery = `
                SELECT ?item ?itemLabel ?image ?creatorLabel ?inception ?collectionLabel WHERE {
                    ?item wdt:P31 wd:Q3305213 .
                    ${instituicoesQuery}
                    ?item wdt:P18 ?image .
                    OPTIONAL { ?item wdt:P170 ?creator . }
                    OPTIONAL { ?item wdt:P571 ?inception . }
                    OPTIONAL { ?item wdt:P195 ?collection . }
                    
                    SERVICE wikibase:label { 
                        bd:serviceParam wikibase:language "pt,en" .
                        ?item rdfs:label ?itemLabel .
                        ?creator rdfs:label ?creatorLabel .
                        ?collection rdfs:label ?collectionLabel .
                    }
                    
                    # Filtro por termo de busca
                    FILTER(CONTAINS(LCASE(?itemLabel), LCASE("${termo}")))
                }
                LIMIT 15
            `;
        }
        
        const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(finalQuery)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.results?.bindings?.length) return null;
        
        // Processa e retorna as obras encontradas
        const obras = data.results.bindings.map(binding => {
            // Constrói URL da imagem do Wikimedia Commons
            const imageFilename = binding.image?.value.split('/').pop();
            const imageUrl = imageFilename 
                ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageFilename)}?width=800`
                : null;
            
            return {
                titulo: binding.itemLabel?.value || "Sem título",
                autor: binding.creatorLabel?.value || "Autor desconhecido",
                ano: binding.inception?.value?.split('-')[0] || "Data desconhecida",
                museu: binding.collectionLabel?.value || "Museu brasileiro",
                imagemUrl: imageUrl,
                credito: `Acervo de ${binding.collectionLabel?.value || "museu brasileiro"} - via Meta-Acervos/Wikidata`,
                wikidataId: binding.item?.value?.split('/').pop()
            };
        });
        
        return obras;
        
    } catch (error) {
        console.error("Erro ao buscar acervo brasileiro:", error);
        return null;
    }
}

// Função para buscar uma obra aleatória de museu brasileiro
async function buscarObraBrasileiraAleatoria() {
    try {
        // Query para pegar uma obra aleatória
        const museusIds = Object.values(INSTITUICOES_WIKIDATA);
        const options = museusIds.map(id => `wd:${id}`).join(" ");
        
        const sparqlQuery = `
            SELECT ?item ?itemLabel ?image ?creatorLabel ?inception ?collectionLabel WHERE {
                ?item wdt:P31 wd:Q3305213 .
                ?item wdt:P195 (${options}) .
                ?item wdt:P18 ?image .
                OPTIONAL { ?item wdt:P170 ?creator . }
                OPTIONAL { ?item wdt:P571 ?inception . }
                OPTIONAL { ?item wdt:P195 ?collection . }
                SERVICE wikibase:label { 
                    bd:serviceParam wikibase:language "pt,en" .
                    ?item rdfs:label ?itemLabel .
                    ?creator rdfs:label ?creatorLabel .
                    ?collection rdfs:label ?collectionLabel .
                }
            }
            ORDER BY RAND()
            LIMIT 5
        `;
        
        const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparqlQuery)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.results?.bindings?.length) return null;
        
        const randomIndex = Math.floor(Math.random() * data.results.bindings.length);
        const obra = data.results.bindings[randomIndex];
        
        const imageFilename = obra.image?.value.split('/').pop();
        
        return {
            titulo: obra.itemLabel?.value || "Sem título",
            autor: obra.creatorLabel?.value || "Autor desconhecido",
            ano: obra.inception?.value?.split('-')[0] || "Data desconhecida",
            museu: obra.collectionLabel?.value || "Museu brasileiro",
            imagemUrl: imageFilename ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageFilename)}?width=800` : null,
            wikidataId: obra.item?.value?.split('/').pop()
        };
        
    } catch (error) {
        console.error("Erro ao buscar obra aleatória brasileira:", error);
        return null;
    }
}

// Integra a busca brasileira no fluxo existente
async function buscarImagemFluxoComBrasil(artistaNome) {
    // Primeiro: tenta acervos brasileiros (MASP, Pinacoteca, etc)
    console.log(`🔍 Buscando no acervo brasileiro para: ${artistaNome}`);
    let resultadoBrasileiro = await buscarAcervoBrasileiro(artistaNome);
    
    if (resultadoBrasileiro && resultadoBrasileiro.length > 0) {
        console.log(`✅ Encontrado ${resultadoBrasileiro.length} obra(s) brasileira(s) para: ${artistaNome}`);
        // Retorna a primeira obra encontrada
        return resultadoBrasileiro[0];
    }
    
    // Fallback: fluxo internacional original
    console.log(`⚠️ Nada encontrado no acervo brasileiro, tentando Wikimedia geral...`);
    let resultadoWikimedia = await buscarWikimedia(artistaNome);
    if (resultadoWikimedia && resultadoWikimedia.imagemUrl) {
        return resultadoWikimedia;
    }
    
    let resultadoMet = await buscarMetropolitan(artistaNome);
    if (resultadoMet && resultadoMet.imagemUrl) {
        return resultadoMet;
    }
    
    let resultadoChicago = await buscarChicago(artistaNome);
    if (resultadoChicago && resultadoChicago.imagemUrl) {
        return resultadoChicago;
    }
    
    let resultadoEuropeana = await buscarEuropeana(artistaNome);
    if (resultadoEuropeana && resultadoEuropeana.imagemUrl) {
        return resultadoEuropeana;
    }
    
    return null;
}
