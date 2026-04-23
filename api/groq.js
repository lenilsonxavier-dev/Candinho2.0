export default async function handler(req, res) {
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "SEM_API_KEY" });
  }

  return res.status(200).json({ ok: true });
}
