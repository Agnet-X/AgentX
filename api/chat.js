export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY غير موجودة' });

  try {
    const { system, messages, image } = req.body;

    // بناء محتوى المحادثة بصيغة Gemini
    const contents = messages.map((m, i) => {
      const role = m.role === 'model' ? 'model' : 'user';

      // إضافة الصورة مع آخر رسالة للمستخدم
      if (image && i === messages.length - 1 && role === 'user') {
        return {
          role,
          parts: [
            { text: m.content || 'صف هذه الصورة' },
            { inline_data: { mime_type: image.mimeType, data: image.data } }
          ]
        };
      }

      return { role, parts: [{ text: m.content }] };
    });

    const body = {
      system_instruction: { parts: [{ text: system || 'أنت مساعد ذكي ومفيد.' }] },
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    };

    const model = 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      return res.status(geminiRes.status).json({ error: data?.error?.message || 'Gemini error' });
    }

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) return res.status(500).json({ error: 'لم يصل رد من Gemini' });

    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(500).json({ error: 'خطأ في السيرفر: ' + err.message });
  }
}
