export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY غير موجودة' });

  try {
    const { system, messages, image } = req.body;

    let userContent;

    // لو في صورة
    if (image) {
      const lastMsg = messages[messages.length - 1];
      userContent = [
        { type: 'text', text: lastMsg?.content || 'صف هذه الصورة' },
        { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.data}` } }
      ];
    } else {
      // نص فقط
      userContent = messages[messages.length - 1]?.content || '';
    }

    const openaiMessages = [
      { role: 'system', content: system || 'أنت مساعد ذكي.' },
      ...messages.slice(0, -1).map(m => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: m.content
      })),
      { role: 'user', content: userContent }
    ];

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: openaiMessages,
        temperature: 0.7,
        max_tokens: 2048
      })
    });

    const data = await openaiRes.json();
    if (!openaiRes.ok) return res.status(openaiRes.status).json({ error: data?.error?.message || 'OpenAI error' });

    const reply = data?.choices?.[0]?.message?.content;
    if (!reply) return res.status(500).json({ error: 'لم يصل رد' });

    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(500).json({ error: 'خطأ في السيرفر: ' + err.message });
  }
}
