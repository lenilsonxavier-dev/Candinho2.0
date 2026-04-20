export default async function handler(req, res) {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ erro: "Sem prompt" });
  }

  try {
    // 🔹 1. cria a geração
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        version: "7762fd07cf82d2b0c1e0b97958a3b16130ad13fe7a22ccf7ecd6c6293e7d5d0c",
        input: {
          prompt: `${prompt}, kids coloring book, black and white line art, thick outline, clean lines, no shading`,
          negative_prompt: "color, shading, shadow, realistic, photo, texture, blur",
          width: 1024,
          height: 1024,
          guidance_scale: 7.5,
          num_inference_steps: 30
        }
      })
    }); // ✅ FECHAMENTO QUE FALTAVA

    let data = await response.json();

    // 🔹 2. esperar resultado
    while (data.status !== "succeeded" && data.status !== "failed") {
      await new Promise(r => setTimeout(r, 1500));

      const check = await fetch(data.urls.get, {
        headers: {
          "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`
        }
      });

      data = await check.json();
    }

    if (data.status === "succeeded") {
      return res.json({ imagem: data.output[0] });
    } else {
      console.error(data);
      return res.status(500).json({ erro: "Erro ao gerar imagem" });
    }

  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: "Erro no servidor" });
  }
}
