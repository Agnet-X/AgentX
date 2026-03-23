export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GROQ_API_KEY    = process.env.GROQ_API_KEY;
  const AICC_API_KEY    = process.env.AICC_API_KEY;
  const OPENAI_API_KEY  = process.env.OPENAI_API_KEY;

  try {
    const { system, messages, image } = req.body;

    // ── صورة → AICC (gpt-4o-mini) ──────────────────────────────
    if (image) {
      if (!AICC_API_KEY) return res.status(500).json({ error: 'AICC_API_KEY غير موجودة' });
      const lastMsg = messages[messages.length - 1];
      const aiccMessages = [
        { role: 'system', content: system || 'أنت مساعد ذكي.' },
        {
          role: 'user',
          content: [
            { type: 'text', text: lastMsg?.content || 'صف هذه الصورة' },
            { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.data}` } }
          ]
        }
      ];
      const aiccRes = await fetch('https://api.ai.cc/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AICC_API_KEY}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: aiccMessages, max_tokens: 2048 })
      });
      const data = await aiccRes.json();
      if (!aiccRes.ok) return res.status(aiccRes.status).json({ error: data?.error?.message || 'AICC error' });
      const reply = data?.choices?.[0]?.message?.content;
      if (!reply) return res.status(500).json({ error: 'لم يصل رد' });
      return res.status(200).json({ reply });
    }

    // ── نص → Groq أولاً ────────────────────────────────────────
    if (GROQ_API_KEY) {
      try {
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
        if (groqRes.ok) {
          const reply = data?.choices?.[0]?.message?.content;
          if (reply) return res.status(200).json({ reply });
        }
      } catch (_) {}
    }

    // ── نص → ChatGPT fallback ───────────────────────────────────
    if (!OPENAI_API_KEY) return res.status(500).json({ error: 'لا يوجد API متاح' });
    const openaiMessages = [
      { role: 'system', content: system || 'أنت مساعد ذكي.' },
      ...messages.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.content }))
    ];
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: openaiMessages, temperature: 0.7, max_tokens: 2048 })
    });
    const openaiData = await openaiRes.json();
    if (!openaiRes.ok) return res.status(openaiRes.status).json({ error: openaiData?.error?.message || 'OpenAI error' });
    const reply = openaiData?.choices?.[0]?.message?.content;
    if (!reply) return res.status(500).json({ error: 'لم يصل رد' });
    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(500).json({ error: 'خطأ في السيرفر: ' + err.message });
  }
}
