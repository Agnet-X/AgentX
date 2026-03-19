export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY غير موجودة' });

  try {
    const { system, messages, image } = req.body;

    const groqMessages = [
      { role: 'system', content: system || 'أنت مساعد ذكي.' },
      ...messages.map(m => {
        if (m.role === 'user' && image && messages.indexOf(m) === messages.length - 1) {
          return {
            role: 'user',
            content: [
              { type: 'text', text: m.content || 'صف هذه الصورة' },
              { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.data}` } }
            ]
          };
        }
        return { role: m.role === 'model' ? 'assistant' : 'user', content: m.content };
      })
    ];

    const model = image ? 'llama-3.2-11b-vision-preview' : 'llama-3.3-70b-versatile';

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({ model, messages: groqMessages, temperature: 0.7, max_tokens: 2048 })
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
