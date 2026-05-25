// api/match.js  —  Vercel serverless function
// Your Gemini key lives in Vercel's environment variables, never in the browser.

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS — allow your frontend to call this endpoint
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  const data = req.body;
  if (!data) {
    return res.status(400).json({ error: 'No profile data received.' });
  }

  const prompt = `You are a tech career counsellor for young Nigerians exploring tech for the first time. Based on the user profile below, recommend the TOP 3 most suitable tech career paths.

Reason holistically over ALL signals — personality, activities, environment preference, and enjoyment type together. Do NOT just return the fields they ticked. If fields conflict with personality/activities, trust personality and activities more. Only return careers with a genuine strong fit — never pad with weak matches.

USER PROFILE:
- Name: ${data.name || 'Not given'}
- Age range: ${data.age || 'Not given'}
- Current status: ${data.status || 'Not given'}
- Tech familiarity: ${data.familiarity || 'Not given'}
- Reasons for interest in tech: ${(data.whyTech || []).join(', ') || 'Not given'}
- Activities they enjoy: ${(data.activities || []).join(', ') || 'Not given'}
- Personality type: ${data.personality || 'Not given'}
- Preferred work environment: ${data.environment || 'Not given'}
- Type of work they'd enjoy most: ${data.enjoy || 'Not given'}
- Fields of interest: ${(data.fields || []).join(', ') || 'Not given'}

Return ONLY valid JSON — no markdown, no backticks, no explanation before or after. Exact structure:
{
  "insight": "2-3 warm, specific sentences addressed to the user by first name (or 'you' if no name). Describe what their profile reveals about them as a person and why their top match suits them.",
  "careers": [
    {
      "title": "Career Title",
      "fitTagline": "5-word tagline",
      "matchScore": 88,
      "description": "2 sentences about what this career involves day-to-day.",
      "whyItFits": "1-2 sentences explaining specifically why THIS user's answers point to this career.",
      "firstStep": "One concrete, free action they can take this week to get started.",
      "skills": ["Skill1", "Skill2", "Skill3", "Skill4"]
    }
  ]
}`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.json().catch(() => ({}));
      throw new Error(errBody?.error?.message || `Gemini error ${geminiRes.status}`);
    }

    const geminiData = await geminiRes.json();
    const raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Strip markdown fences if Gemini wraps the output
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const result = JSON.parse(clean);

    return res.status(200).json(result);

  } catch (err) {
    console.error('Career match error:', err.message);
    return res.status(500).json({ error: err.message || 'Something went wrong.' });
  }
}
