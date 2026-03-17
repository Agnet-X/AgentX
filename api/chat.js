export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: 'API key غير موجودة' });
  }

  try {
    const { system, messages } = req.body;

    const deepseekMessages = [
      { role: 'system', content: system || 'أنت مساعد ذكي ومفيد باللغة العربية.' },
      ...messages.map(m => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: m.content
      }))
    ];

    const deepseekRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: deepseekMessages,
        temperature: 0.7,
        max_tokens: 2048,
      })
    });

    const data = await deepseekRes.json();

    if (!deepseekRes.ok) {
      return res.status(deepseekRes.status).json({ error: data?.error?.message || 'DeepSeek API error' });
    }

    const reply = data?.choices?.[0]?.message?.content;

    if (!reply) return res.status(500).json({ error: 'لم يصل رد' });

    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(500).json({ error: 'خطأ في السيرفر: ' + err.message });
  }
}
