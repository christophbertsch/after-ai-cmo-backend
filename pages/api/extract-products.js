import { createClient } from '@supabase/supabase-js';
import xml2js from 'xml2js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://after-ai-cmo-dq14.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });

  try {
    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .list('uploads', { limit: 1, sortBy: { column: 'created_at', order: 'desc' } });

    if (error || !data.length) {
      console.error('Supabase list error:', error);
      return res.status(404).json({ message: 'No uploaded catalog found.' });
    }

    const latestFile = data[0];
    const fileUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_BUCKET}/uploads/${latestFile.name}`;

    const response = await fetch(fileUrl, { duplex: 'half' });
    const text = await response.text();
    const parsed = await xml2js.parseStringPromise(text, { explicitArray: false });

    let items = parsed?.PIES?.Items?.Item || [];
    items = Array.isArray(items) ? items : [items];

    res.status(200).json({
      message: '✅ Products extracted successfully!',
      totalProducts: items.length,
    });
  } catch (error) {
    console.error('Error extracting products:', error);
    res.status(500).json({ message: 'Failed to extract products.', error: error.message });
  }
}
