import { createClient } from '@supabase/supabase-js';
import xml2js from 'xml2js';
import Papa from 'papaparse';

export const config = {
  api: {
    bodyParser: false,
  },
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', 'https://after-ai-cmo-dq14.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization');

  // Handle Preflight OPTIONS Request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { data, error } = await supabase
      .storage
      .from(process.env.SUPABASE_BUCKET)
      .list('', { limit: 1, sortBy: { column: 'created_at', order: 'desc' } });

    if (error || !data || data.length === 0) {
      console.error('Supabase fetch error or no file found');
      return res.status(500).json({ message: 'No catalog file found.' });
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
      }));
    } else if (latestFile.name.endsWith('.xml')) {
      const parsed = await xml2js.parseStringPromise(text);
      const articles = parsed?.BMECAT?.T_NEW_CATALOG?.[0]?.ARTICLE || [];
      products = articles.map(article => ({
        ProductID: article.SUPPLIER_AID?.[0] || '',
        ShortText: article.ARTICLE_DETAILS?.[0]?.DESCRIPTION_SHORT?.[0] || '',
        Manufacturer: article.ARTICLE_DETAILS?.[0]?.MANUFACTURER_NAME?.[0] || '',
      }));
    }

    res.status(200).json({ seo: products });

  } catch (error) {
    console.error('Optimize SEO failed:', error);
    res.status(500).json({ message: 'SEO optimization failed.' });
  }
}
