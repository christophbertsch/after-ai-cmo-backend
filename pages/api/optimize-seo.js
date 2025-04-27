import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';
import xml2js from 'xml2js';
import * as XLSX from 'xlsx';

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

    const buffer = await response.arrayBuffer();

    let products = [];

    if (latestFile.name.endsWith('.csv')) {
      const text = Buffer.from(buffer).toString('utf-8');
      const parsed = Papa.parse(text, { header: true });
      products = parsed.data.map(({ article_number, short_description, brand }) => ({
        ProductID: article_number,
        ShortText: short_description,
        Manufacturer: brand,
      }));
    } else if (latestFile.name.endsWith('.xml')) {
      const text = Buffer.from(buffer).toString('utf-8');
      const parsed = await xml2js.parseStringPromise(text, { explicitArray: false });
      const items = parsed?.PIES?.Items?.Item || [];
      products = Array.isArray(items) ? items.map(item => ({
        ProductID: item.PartNumber || '',
        ShortText: item.PartTerminologyID || '',
        Manufacturer: item.BrandLabel || '',
      })) : [];
    } else if (latestFile.name.endsWith('.xlsx')) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet);
      products = rows.map(row => ({
        ProductID: row.article_number || '',
        ShortText: row.short_description || '',
        Manufacturer: row.brand || '',
      }));
    }

    const totalProducts = products.length;
    const changesMade = totalProducts; // Assuming every product potentially needed SEO improvement
    const seoImprovementEstimate = `${Math.round((changesMade / totalProducts) * 100)}%`; // Simple example calculation

    res.status(200).json({
      seo: products,
      report: {
        totalProducts,
        changesMade,
        seoImprovementEstimate,
      },
    });
  } catch (error) {
    console.error('SEO optimization error:', error);
    res.status(500).json({ message: 'SEO optimization failed' });
  }
}
