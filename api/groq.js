const GITHUB_BASE = "https://raw.githubusercontent.com/lenilsonxavier-dev/Candinho2.0/main/data/";

// ... (JSON_FILES permanecem iguais)

// ======================= UTILITÁRIOS MELHORADOS =======================
function normalizar(texto) {
    if (!texto) return "";
    return texto.toString().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[^\w\s]/g, "") // Remove pontuação
        .trim();
}

// Função para extrair texto de campos que podem ser String ou Array
function extrairTexto(campo) {
    if (!campo) return "";
    if (Array.isArray(campo)) return campo.join(" ");
    return campo;
}

// ======================= BUSCA DE ENTIDADE (PRECISA) =======================
function buscarEntidadeNoAcervo(pergunta, data) {
    const textoBusca = normalizar(pergunta);
    
    // Lista de palavras que indicam que a criança quer saber sobre alguém
    const termosQuem = ["quem foi", "quem e", "conhece a", "conhece o", "fale sobre", "quem e essa", "quem e esse"];
    const ehPerguntaQuem = termosQuem.some(t => textoBusca.includes(t));

    for (const [arquivo, categoria] of Object.entries(data)) {
        if (!categoria || typeof categoria !== "object") continue;

        for (const [chave, item] of Object.entries(categoria)) {
            // 1. Nome da chave (ex: conceicao_evaristo -> conceicao evaristo)
            const nomeChave = normalizar(chave.replace(/_/g, " "));
            
            // 2. Palavras-chave dentro do JSON
            const palavrasChave = Array.isArray(item?.palavras_chave) 
                ? item.palavras_chave.map(normalizar) 
                : [];
            
            // 3. Nome propriamente dito
            const nomeItem = normalizar(item?.nome || "");

            // Verificação de match
            const matchNome = (nomeChave && textoBusca.includes(nomeChave)) || 
                             (nomeItem && textoBusca.includes(nomeItem));
            const matchTags = palavrasChave.some(p => textoBusca.includes(p));

            if (matchNome || matchTags) {
                console.log(`Match encontrado em ${arquivo}: ${chave}`);
                
                // Prioridade de resposta para "Quem foi?"
                let biografia = extrairTexto(item.explicacao_infantil) || 
                                extrairTexto(item.explicacao_curta) || 
                                extrairTexto(item.inicio) ||
                                extrairTexto(item.quem_foi);
                
                // Se perguntou onde nasceu ou quando nasceu
                if (textoBusca.includes("nasceu") || textoBusca.includes("nascimento") || textoBusca.includes("onde")) {
                    biografia = item.onde_nasceu_适应_resposta || item.onde_nasceu_resposta || biografia;
                }

                return {
                    nome: item.nome || nomeChave,
                    info: biografia,
                    curiosidade: extrairTexto(item.curiosidade),
                    o_que_fez: extrairTexto(item.o_que_ele_fez)
                };
            }
        }
    }
    return null;
}

// ======================= HANDLER PRINCIPAL =======================
export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).send();

    try {
        const { mensagem, memoria = {} } = req.body;
        const data = await carregarTodosJSONs(); // Sua função de fetch (mantenha a que usa Promise.all)

        // 1. Tenta encontrar a escritora/artista no seu JSON
        const achado = buscarEntidadeNoAcervo(mensagem, data);

        let instrucaoConhecimento = "";
        if (achado) {
            instrucaoConhecimento = `
                CONHECIMENTO DO ACERVO:
                Sobre: ${achado.nome}
                Biografia: ${achado.info}
                O que fez: ${achado.o_que_fez}
                Curiosidade: ${achado.curiosidade}
                Use essas informações acima para responder à criança.
            `;
        }

        // 2. Sistema de Personalidade
        const promptSistema = `
            Você é o Candinho, mentor de arte e literatura para crianças de 10 anos.
            Seu tom é carinhoso, inspirador e educativo.
            
            ${instrucaoConhecimento}

            REGRAS:
            - Se o CONHECIMENTO DO ACERVO estiver presente, use-o como base absoluta.
            - Responda em Português do Brasil.
            - JAMAIS use linguagem neutra (amiguês, elus, amigues).
            - Não use diminutivos excessivos.
            - Máximo 3 linhas de resposta.
            - Se não souber e não estiver no acervo, incentive a arte mas não invente fatos.
        `;

        // 3. Chamada ao Groq
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                    { role: "system", content: promptSistema },
                    { role: "user", content: mensagem }
                ],
                temperature: 0.4
            })
        });

        const dataIA = await response.json();
        let reply = dataIA.choices[0].message.content;

        return res.status(200).json({ reply });

    } catch (err) {
        console.error(err);
        return res.status(200).json({ reply: "Puxa, minha memória falhou um pouquinho. Pode repetir?" });
    }
}
