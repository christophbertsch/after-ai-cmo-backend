// Allow CORS
res.setHeader('Access-Control-Allow-Credentials', true);
res.setHeader('Access-Control-Allow-Origin', 'https://after-ai-cmo-dq14.vercel.app');
res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization');

// Handle preflight requests
if (req.method === 'OPTIONS') {
  res.status(200).end();
  return;
}

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import xml2js from 'xml2js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req) {
  try {
    const { data, error } = await supabase
      .storage
      .from(process.env.SUPABASE_BUCKET)
      .list('', { limit: 1, sortBy: { column: 'created_at', order: 'desc' } });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ message: 'Error fetching catalog' }, { status: 500 });
    }

    const latestFile = data[0];
    const fileUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_BUCKET}/${latestFile.name}`;

    const fileRes = await fetch(fileUrl);
    const text = await fileRes.text();

    let products = [];
    if (latestFile.name.endsWith('.csv')) {
      const parsed = Papa.parse(text, { header: true });
      products = parsed.data.map(product => ({
        ProductID: product.article_number,
        ShortText: product.short_description,
        Manufacturer: product.brand,
        Currency: product.currency || 'EUR',
        Unit: product.unit || 'PC',
        Price: product.price || '',
      }));
    } else if (latestFile.name.endsWith('.xml')) {
      const parsed = await xml2js.parseStringPromise(text);
      const articles = parsed?.BMECAT?.T_NEW_CATALOG?.[0]?.ARTICLE || [];
      products = articles.map(article => ({
        ProductID: article.SUPPLIER_AID?.[0] || '',
        ShortText: article.ARTICLE_DETAILS?.[0]?.DESCRIPTION_SHORT?.[0] || '',
        Manufacturer: article.ARTICLE_DETAILS?.[0]?.MANUFACTURER_NAME?.[0] || '',
        Currency: 'EUR',
        Unit: 'PC',
        Price: '',
      }));
    } else {
      return NextResponse.json({ message: 'Unsupported file type' }, { status: 400 });
    }

    const seoResults = [];

    for (const product of products.slice(0, 20)) { // Limit 20 for free tier
      const prompt = `Write an SEO-optimized product title and description for this product:\\nProductID: ${product.ProductID}\\nShortText: ${product.ShortText}\\nManufacturer: ${product.Manufacturer}`;

      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.5,
        }),
      });

      const aiData = await aiRes.json();
      const seoText = aiData.choices?.[0]?.message?.content || '';

      seoResults.push({
        ProductID: product.ProductID,
        Manufacturer: product.Manufacturer,
        SEO: seoText,
      });
    }

    return NextResponse.json({ seo: seoResults });
  } catch (error) {
    console.error('SEO optimization error:', error);
    return NextResponse.json({ message: 'SEO generation failed' }, { status: 500 });
  }
}
