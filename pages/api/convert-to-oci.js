import { createClient } from '@supabase/supabase-js';
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

    const buffer = await response.arrayBuffer();
    const text = Buffer.from(buffer).toString('utf-8');

    const parsed = await xml2js.parseStringPromise(text, { explicitArray: false });
    const items = parsed?.PIES?.Items?.Item || [];

    const ociProducts = Array.isArray(items) ? items.map(item => ({
      "NEW_ITEM-MATNR": item.PartNumber || '',
      "NEW_ITEM-DESCRIPTION": item.PartTerminologyID || '',
      "NEW_ITEM-MANUFACTURER": item.BrandLabel || '',
      "NEW_ITEM-VENDORMAT": item.ItemLevelGTIN || '',
    })) : [];

    const ociCatalogJson = JSON.stringify(ociProducts, null, 2);
    const ociFileName = `oci-catalog-${Date.now()}.json`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .upload(`oci/${ociFileName}`, ociCatalogJson, {
        contentType: 'application/json',
        duplex: 'half',
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    res.status(200).json({
      message: 'OCI conversion completed!',
      ociFile: ociFileName,
      ociProductsCount: ociProducts.length,
    });
  } catch (error) {
    console.error('OCI conversion error:', error);
    res.status(500).json({ message: 'OCI conversion failed', error: error.message });
  }
}
