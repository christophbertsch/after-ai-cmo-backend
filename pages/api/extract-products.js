import { createClient } from '@supabase/supabase-js';
import { detectCatalogType } from '../../utils/detectCatalogType';
import { parsePIESCatalog } from '../../utils/piesParser';
import { parseBMEcatCatalog } from '../../utils/bmecatParser';
import { parseBMEcatETIMCatalog } from '../../utils/bmecatEtimParser';
import { parseBMEcat2005Catalog } from '../../utils/bmecat2005Parser';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });

  try {
    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .list('uploads', { limit: 1, sortBy: { column: 'created_at', order: 'desc' } });

    if (error || !data.length) return res.status(404).json({ message: 'No uploaded catalog found.' });

    const latestFile = data[0];
    const fileUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_BUCKET}/uploads/${latestFile.name}`;
    const response = await fetch(fileUrl);
    const text = await response.text();

    const catalogType = await detectCatalogType(text);
    let products = [];

    if (catalogType === 'PIES') {
      products = await parsePIESCatalog(text);
    } else if (catalogType === 'BMEcat') {
      products = await parseBMEcatCatalog(text);
    } else if (catalogType === 'BMEcatETIM') {
      products = await parseBMEcatETIMCatalog(text);
    } else if (catalogType === 'BMEcat2005') {
      products = await parseBMEcat2005Catalog(text);
    } else {
      return res.status(400).json({ message: 'Unsupported catalog format.' });
    }

    res.status(200).json({ message: 'Products extracted successfully!', totalProducts: products.length });
  } catch (error) {
    console.error('Extraction error:', error);
    res.status(500).json({ message: 'Failed to extract products.', error: error.message });
  }
}
