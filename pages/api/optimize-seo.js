import { createClient } from '@supabase/supabase-js';
import { detectCatalogType } from '../../utils/detectCatalogType';
import { parsePIESCatalog } from '../../utils/piesParser';
import { parseBMEcatCatalog } from '../../utils/bmecatParser';
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

async function optimizeProducts(products, limit = products.length) {
  const optimizedProducts = [];

  for (const product of products.slice(0, limit)) {
    const embedding = await generateEmbedding(product.OriginalDescription);

    const searchResult = await qdrant.search('after_ai_products', {
      vector: embedding,
      limit: 1,
    });

    optimizedProducts.push({
      ...product,
      OptimizedDescription: searchResult.length ? searchResult[0].payload.optimizedDescription : product.OriginalDescription,
    });
  }

  return optimizedProducts;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://after-ai-cmo-dq14.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  try {
    const { optimizeAll } = req.query;

    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .list('uploads', { limit: 1, sortBy: { column: 'created_at', order: 'desc' } });

    if (error || !data.length) {
      return res.status(404).json({ message: 'No catalog files found.' });
    }

    const latestFile = data[0];
    const fileUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_BUCKET}/uploads/${latestFile.name}`;

    const response = await fetch(fileUrl, { duplex: 'half' });
    const buffer = await response.arrayBuffer();
    const text = Buffer.from(buffer).toString('utf-8');

    // ✨ Detect Catalog Type
    const catalogType = await detectCatalogType(text);

    let products = [];

    if (catalogType === 'PIES') {
      products = await parsePIESCatalog(text);
    } else if (catalogType === 'BMEcat') {
      products = await parseBMEcatCatalog(text);
    } else {
      return res.status(400).json({ message: 'Unsupported catalog format.' });
    }

    // ✨ Optimize Products
    const optimizedProducts = await optimizeProducts(products, optimizeAll ? products.length : 10);

    res.status(200).json({
      seo: optimizedProducts,
      report: {
        totalProducts: products.length,
        optimizedCount: optimizedProducts.length,
      },
    });
  } catch (error) {
    console.error('SEO optimization error:', error);
    res.status(500).json({ message: 'SEO optimization failed', error: error.message });
  }
}
