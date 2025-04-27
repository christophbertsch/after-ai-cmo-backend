import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';
import xml2js from 'xml2js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://after-ai-cmo-dq14.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .list('uploads', { limit: 1, sortBy: { column: 'created_at', order: 'desc' } });

    if (error || !data.length) {
      console.error('Supabase list error:', error);
      return res.status(404).json({ message: 'No files found.' });
    }

    const latestFile = data[0];
    const fileUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_BUCKET}/uploads/${latestFile.name}`;
    const response = await fetch(fileUrl, { duplex: 'half' });
    const text = await response.text();

    let products = [];

    if (latestFile.name.endsWith('.csv')) {
      const parsed = Papa.parse(text, { header: true });
      products = parsed.data.map(({ article_number, short_description, brand }) => ({
        ProductID: article_number,
        ShortText: short_description,
        Manufacturer: brand,
      }));
    } else if (latestFile.name.endsWith('.xml')) {
      const parsed = await xml2js.parseStringPromise(text);
      products = parsed?.BMECAT?.T_NEW_CATALOG?.[0]?.ARTICLE?.map(article => ({
        ProductID: article.SUPPLIER_AID?.[0] || '',
        ShortText: article.ARTICLE_DETAILS?.[0]?.DESCRIPTION_SHORT?.[0] || '',
        Manufacturer: article.ARTICLE_DETAILS?.[0]?.MANUFACTURER_NAME?.[0] || '',
      })) || [];
    }

    res.status(200).json({ seo: products });
  } catch (error) {
    console.error('SEO optimization error:', error);
    res.status(500).json({ message: 'SEO optimization failed' });
  }
}
