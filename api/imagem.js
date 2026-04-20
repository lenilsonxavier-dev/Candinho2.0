export default async function handler(req, res) {
  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ erro: "Sem prompt" });

  try {
    // 1) cria a previsão
    const create = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        // 👇 use 'model' em vez de 'version'
        model: "stability-ai/sdxl",
        input: {
          prompt: `${prompt}, kids coloring book, black and white line art, thick outline, clean lines, no shading`,
          negative_prompt: "color, shading, shadow, realistic, photo, texture, blur",
          width: 1024,
          height: 1024,
          guidance_scale: 7.5,
          num_inference_steps: 30
        }
      })
    });

    // 👇 mostra erro real do Replicate
    if (!create.ok) {
      const errTxt = await create.text();
      console.error("Replicate create error:", errTxt);
      return res.status(500).json({ erro: errTxt });
    }

    let data = await create.json();

    // 2) espera terminar
    while (data.status !== "succeeded" && data.status !== "failed") {
      await new Promise(r => setTimeout(r, 1500));

      const check = await fetch(data.urls.get, {
        headers: {
          "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`
        }
      });

      if (!check.ok) {
        const errTxt = await check.text();
        console.error("Replicate check error:", errTxt);
        return res.status(500).json({ erro: errTxt });
      }

      data = await check.json();
    }

    if (data.status === "succeeded") {
      return res.json({ imagem: data.output?.[0] });
    } else {
      console.error("Falhou:", data);
      return res.status(500).json({ erro: "Falha ao gerar imagem" });
    }

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ erro: "Erro no servidor" });
  }
}
