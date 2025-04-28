import { createClient } from '@supabase/supabase-js';
import xml2js from 'xml2js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://after-ai-cmo-dq14.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  try {
    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .list('seo', { limit: 1, sortBy: { column: 'created_at', order: 'desc' } });

    if (error || !data.length) {
      console.error('Supabase list error:', error);
      return res.status(404).json({ message: 'No optimized file found.' });
    }

    const latestOptimizedFile = data[0];
    const optimizedFileUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_BUCKET}/seo/${latestOptimizedFile.name}`;

    const response = await fetch(optimizedFileUrl, { duplex: 'half' });
    const optimizedJson = await response.json();

    res.status(200).json({
      message: '✅ Optimized catalog integrated successfully!',
      optimizedFile: latestOptimizedFile.name,
      totalOptimizedProducts: optimizedJson.length || 0,
    });
  } catch (error) {
    console.error('Integration error:', error);
    res.status(500).json({ message: 'Failed to integrate catalog.', error: error.message });
  }
}
