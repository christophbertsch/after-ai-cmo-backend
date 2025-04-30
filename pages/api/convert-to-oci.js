// convert-to-oci.js
import { createClient } from '@supabase/supabase-js';
import xml2js from 'xml2js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  try {
    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .list('optimized', { limit: 1, sortBy: { column: 'created_at', order: 'desc' } });

    if (error || !data.length) return res.status(404).json({ message: 'No optimized catalog found.' });

    const latestFile = data[0];
    const fileUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_BUCKET}/optimized/${latestFile.name}`;

    const response = await fetch(fileUrl);
    const optimizedJson = await response.json();

    const ociRows = optimizedJson.map((item) => ({
      'NEW_ITEM-MATNR': item.ProductID,
      'NEW_ITEM-DESCRIPTION': item.OptimizedDescription,
      'NEW_ITEM-MANUFACTURER': item.Manufacturer,
      'NEW_ITEM-VENDORMAT': item.GTIN,
    }));

    const ociExport = JSON.stringify(ociRows, null, 2);
    const ociFileName = `oci-export-${Date.now()}.json`;

    await supabase.storage.from(process.env.SUPABASE_BUCKET).upload(`oci/${ociFileName}`, ociExport, {
      contentType: 'application/json',
      cacheControl: '3600',
      upsert: true,
    });

    res.status(200).json({
      message: '✅ OCI export completed!',
      ociFile: ociFileName,
      totalProducts: ociRows.length,
    });
  } catch (error) {
    console.error('OCI export error:', error);
    res.status(500).json({ message: 'OCI export failed', error: error.message });
  }
}
