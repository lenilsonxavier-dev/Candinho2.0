export default async function handler(req, res) {
  try {
    const response = await fetch("https://candinho2.vercel.app/api/imagem", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();

    res.json(data);

  } catch (err) {
    res.status(500).json({ erro: "Erro ao conectar com IA" });
  }
}
