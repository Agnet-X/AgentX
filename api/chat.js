export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GROQ_API_KEY   = process.env.GROQ_API_KEY;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  try {
    const { system, messages, image } = req.body;

    // إذا فيه صورة → Gemini Vision
    if (image) {
      if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY غير موجودة' });

      const lastMsg = messages[messages.length - 1];
      const body = {
        contents: [{
          parts: [
            { text: lastMsg?.content || 'صف هذه الصورة' },
            { inline_data: { mime_type: image.mimeType, data: image.data } }
          ]
        }],
        system_instruction: { parts: [{ text: system || 'أنت مساعد ذكي.' }] },
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
      };

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      );

      const data = await geminiRes.json();
      if (!geminiRes.ok) return res.status(geminiRes.status).json({ error: data?.error?.message || 'Gemini error' });

      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!reply) return res.status(500).json({ error: 'لم يصل رد من Gemini' });
      return res.status(200).json({ reply });
    }

    // نص عادي → Groq
    if (!GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY غير موجودة' });

    const groqMessages = [
      { role: 'system', content: system || 'أنت مساعد ذكي.' },
      ...messages.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.content }))
    ];

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: groqMessages, temperature: 0.7, max_tokens: 2048 })
    });

    const data = await groqRes.json();
    if (!groqRes.ok) return res.status(groqRes.status).json({ error: data?.error?.message || 'Groq error' });

    const reply = data?.choices?.[0]?.message?.content;
    if (!reply) return res.status(500).json({ error: 'لم يصل رد' });
    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(500).json({ error: 'خطأ في السيرفر: ' + err.message });
  }
}
