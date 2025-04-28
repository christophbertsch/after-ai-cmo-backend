import { createClient } from '@supabase/supabase-js';
import xml2js from 'xml2js';
import OpenAI from 'openai';
import { QdrantClient } from '@qdrant/js-client-rest';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const qdrant = new QdrantClient({ url: process.env.QDRANT_URL, apiKey: process.env.QDRANT_API_KEY });

export const config = {
  api: { bodyParser: false },
};

async function generateEmbedding(text) {
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  });
  return embeddingResponse.data[0].embedding;
}

async function optimizeProducts(items, limit = items.length) {
  const optimizedProducts = [];

  for (const item of items.slice(0, limit)) {
    const attributesText = item.ProductAttributes
      ? Object.values(item.ProductAttributes).map(attr => `${attr.Name || ''} ${attr.Value || ''}`).join(' ')
      : '';

    const interchangeText = item.PartInterchangeInfo
      ? Object.values(item.PartInterchangeInfo).map(info => `${info.OEBrand || ''} ${info.OEPartNumber || ''}`).join(' ')
      : '';

    const originalDesc = `${item.PartTerminologyID || ''} ${item.Description || ''} ${item.ExtendedInformation || ''} ${attributesText} ${interchangeText}`.trim();

    const embedding = await generateEmbedding(originalDesc);

    const searchResult = await qdrant.search('after_ai_products', {
      vector: embedding,
      limit: 1,
    });

    optimizedProducts.push({
      ProductID: item.PartNumber || '',
      OriginalDescription: originalDesc,
      OptimizedDescription: searchResult.length ? searchResult[0].payload.optimizedDescription : originalDesc,
      Manufacturer: item.BrandLabel || '',
      GTIN: item.ItemLevelGTIN || '',
      HazardousMaterial: item.HazardousMaterialCode || '',
      ExtendedInformation: item.ExtendedInformation || '',
      ProductAttributes: item.ProductAttributes || '',
      PartInterchangeInfo: item.PartInterchangeInfo || '',
      DigitalAssets: item.DigitalAssets || '',
    });
  }

  return optimizedProducts;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  try {
    const { optimizeAll } = req.query;

    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .list('uploads', { limit: 1, sortBy: { column: 'created_at', order: 'desc' } });

    if (error || !data.length) return res.status(404).json({ message: 'No files found.' });

    const latestFile = data[0];
    const fileUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_BUCKET}/uploads/${latestFile.name}`;

    const response = await fetch(fileUrl, { duplex: 'half' }); // <-- FIXED HERE
    const buffer = await response.arrayBuffer();
    const text = Buffer.from(buffer).toString('utf-8');

    const parsed = await xml2js.parseStringPromise(text, { explicitArray: false });

    let items = parsed?.PIES?.Items?.Item || [];
    if (!Array.isArray(items)) items = [items];

    const optimizedProducts = await optimizeProducts(items, optimizeAll ? items.length : 10);

    res.status(200).json({
      seo: optimizedProducts,
      report: {
        totalProducts: items.length,
        optimizedCount: optimizedProducts.length,
      },
    });
  } catch (error) {
    console.error('SEO optimization error:', error);
    res.status(500).json({ message: 'SEO optimization failed', error: error.message });
  }
}
