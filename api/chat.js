export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GROQ_API_KEY       = process.env.GROQ_API_KEY;
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  try {
    const { system, messages, image } = req.body;

    // صورة → OpenRouter Vision
    if (image) {
      if (!OPENROUTER_API_KEY) return res.status(500).json({ error: 'OPENROUTER_API_KEY غير موجودة' });

      const lastMsg = messages[messages.length - 1];
      const orMessages = [
        { role: 'system', content: system || 'أنت مساعد ذكي.' },
        {
          role: 'user',
          content: [
            { type: 'text', text: lastMsg?.content || 'صف هذه الصورة' },
            { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.data}` } }
          ]
        }
      ];

      const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://agent-x-w74j.vercel.app',
          'X-Title': 'AgentX'
        },
        body: JSON.stringify({
          model: 'google/gemma-3-27b-it:free',
          messages: orMessages,
          max_tokens: 2048
        })
      });

      const data = await orRes.json();
      if (!orRes.ok) return res.status(orRes.status).json({ error: data?.error?.message || 'OpenRouter error' });

      const reply = data?.choices?.[0]?.message?.content;
      if (!reply) return res.status(500).json({ error: 'لم يصل رد' });
      return res.status(200).json({ reply });
    }

    // نص → Groq
    if (!GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY غير موجودة' });

    const groqMessages = [
      { role: 'system', content: system || 'أنت مساعد ذكي.' },
      ...messages.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.content }))
    ];

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: groqMessages,
        temperature: 0.7,
        max_tokens: 2048
      })
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
