import { NextResponse } from 'next/server';

export async function POST(req) {
  const { message } = await req.json();

  const payload = {
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are After AI, an intelligent assistant specialized in automotive and industrial product catalogs.

Your tasks include:
- Helping suppliers manage and improve product data
- Generating SEO titles and descriptions for products
- Advising on price comparison and competitor monitoring
- Explaining MAM/PIM best practices
- Assisting with catalog imports (CSV, BMEcat, TecDoc, PIES)

Always answer with professional, clear, and actionable information.`,
      },
      { role: "user", content: message }
    ],
    temperature: 0.5
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  return NextResponse.json({ reply: data.choices[0].message.content });
}
