import { GoogleGenAI } from "@google/genai";

const MODEL = 'gemini-3-flash-preview';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
    return;
  }

  try {
    const { contents, config } = req.body || {};
    if (!contents) {
      res.status(400).json({ error: 'Missing contents' });
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config
    });

    res.status(200).json({ text: response.text || "" });
  } catch (err: any) {
    console.error('Gemini API error:', err);
    res.status(500).json({ error: 'Gemini request failed' });
  }
}
