import { createClient } from '@supabase/supabase-js';
import xml2js from 'xml2js';
import OpenAI from 'openai';
import { QdrantClient } from '@qdrant/js-client-rest';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const qdrant = new QdrantClient({ url: process.env.QDRANT_URL, apiKey: process.env.QDRANT_API_KEY });

async function generateEmbedding(text) {
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  });
  return embeddingResponse.data[0].embedding;
}

async function optimizeProducts(items, limit) {
  const optimized = [];
  for (const item of items.slice(0, limit)) {
    const attributesText = item.ProductAttributes
      ? Object.values(item.ProductAttributes).map(attr => `${attr.Name} ${attr.Value}`).join(' ')
      : '';
    const interchangeText = item.PartInterchangeInfo
      ? Object.values(item.PartInterchangeInfo).map(info => `${info.OEBrand} ${info.OEPartNumber}`).join(' ')
      : '';

    const originalDesc = `${item.PartTerminologyID || ''} ${item.Description || ''} ${item.ExtendedInformation || ''} ${attributesText} ${interchangeText}`.trim();
    const embedding = await generateEmbedding(originalDesc);

    const searchResult = await qdrant.search('after_ai_products', {
      vector: embedding,
      limit: 1,
    });

    optimized.push({
      ProductID: item.PartNumber || '',
      OptimizedDescription: searchResult.length ? searchResult[0].payload.optimizedDescription : originalDesc,
    });
  }
  return optimized;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  try {
    const { data, error } = await supabase
      .storage
      .from(process.env.SUPABASE_BUCKET)
      .list('uploads', { limit: 1, sortBy: { column: 'created_at', order: 'desc' } });

    if (error || !data.length) return res.status(404).json({ message: 'No catalog found.' });

    const latestFile = data[0];
    const response = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_BUCKET}/uploads/${latestFile.name}`);
    const buffer = await response.arrayBuffer();
    const text = Buffer.from(buffer).toString('utf-8');

    const parsed = await xml2js.parseStringPromise(text, { explicitArray: false });
    let items = parsed?.PIES?.Items?.Item || [];
    if (!Array.isArray(items)) items = [items];

    const limit = req.query.all === 'true' ? items.length : 10;
    const optimizedProducts = await optimizeProducts(items, limit);

    res.status(200).json({
      message: `✅ SEO optimization complete for ${optimizedProducts.length} products.`,
      optimizedProducts,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'SEO optimization failed.', error: error.message });
  }
}
