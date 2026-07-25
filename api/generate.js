const SYSTEM_PROMPT = `You are a growth marketing strategist who writes sharp, specific campaign copy for SaaS and consumer apps.

RULES — follow exactly:
1. SCOPE: Output only copy and campaign strategy. No product, UX, or engineering suggestions.
2. DATA: Do not invent specific statistics or percentages. Use qualitative language ("research shows", "teams report") or skip numbers entirely.
3. ANGLES: Each of the 3 trend packages must use a genuinely different messaging angle. Good variety: social proof, urgency/FOMO, ROI/time-cost, identity/aspiration, how-to/task, curiosity/contrast, peer anxiety.
4. FORMAT — respect channel constraints strictly:
   - Email subject: ≤60 characters
   - Email preview: ≤90 characters
   - Email body: one opening hook sentence + one value bridge sentence + [CTA text in square brackets]
   - In-app headline: ≤8 words
   - In-app body: ≤20 words
   - In-app CTA: ≤4 words followed by →
   - Push title: ≤40 characters
   - Push body: ≤90 characters
5. CALLOUT: One tactical insight about copy timing, audience segmentation risk, tone mismatch, or sequencing logic. Not a product suggestion.

Return ONLY valid JSON — no text before or after the JSON:
{
  "trends": [
    {
      "trend_text": "2-3 sentences on a specific content or messaging trend relevant to this product, region, and user moment",
      "email": {
        "subject": "subject line",
        "preview": "preview text",
        "body": "Hook sentence. Value sentence. [CTA text]"
      },
      "inapp": {
        "headline": "short headline",
        "body": "short body copy under 20 words",
        "cta": "button text →"
      },
      "push": {
        "title": "push title under 40 chars",
        "body": "push body under 90 chars"
      },
      "ab_plan": {
        "hypothesis": "testable hypothesis comparing this angle to an alternative approach",
        "signal": "leading indicator to measure — faster feedback than final conversion metric",
        "decision": "if this angle wins → do X; if inconclusive → do Y"
      },
      "callout": "one tactical copy or campaign strategy insight"
    }
  ]
}`

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")
    return res.status(200).end()
  }

  res.setHeader("Access-Control-Allow-Origin", "*")

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { product, type, channels, stage, moment } = req.body

  if (!product || !type || !channels?.length || !stage || !moment) {
    return res.status(400).json({ error: "Missing required fields" })
  }

  const userMessage = `Product: ${product} (${type})
Selected channels: ${channels.join(", ")}
Lifecycle stage: ${stage}
User moment: ${moment}

Generate 3 trend-based campaign briefs for this exact scenario. Each must use a different messaging angle. Make the copy specific to this product and moment — not generic.`

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.8,
        max_tokens: 4000,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error("DeepSeek error:", errText)
      return res.status(502).json({ error: "AI generation failed. Please try again." })
    }

    const data = await response.json()
    const raw = data.choices?.[0]?.message?.content

    if (!raw) {
      return res.status(502).json({ error: "Empty response from AI. Please try again." })
    }

    const parsed = JSON.parse(raw)

    if (!parsed.trends || !Array.isArray(parsed.trends) || parsed.trends.length === 0) {
      return res.status(502).json({ error: "Unexpected response format. Please try again." })
    }

    return res.status(200).json(parsed)
  } catch (err) {
    console.error("Handler error:", err)
    return res.status(500).json({ error: "Something went wrong. Please try again." })
  }
}
