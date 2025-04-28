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

async function optimizeProduct(item) {
  const originalDesc = `${item.PartTerminologyID || ''} ${item.Description || ''} ${item.ExtendedInformation || ''}`.trim();
  const embedding = await generateEmbedding(originalDesc);

  const searchResult = await qdrant.search('after_ai_products', {
    vector: embedding,
    limit: 1,
  });

  return {
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
  };
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/plain');
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  try {
    const { optimizeAll } = req.query;

    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .list('uploads', { limit: 1, sortBy: { column: 'created_at', order: 'desc' } });

    if (error || !data.length) return res.status(404).end('No files found.');

    const latestFile = data[0];
    const fileUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_BUCKET}/uploads/${latestFile.name}`;
    const response = await fetch(fileUrl);
    const buffer = await response.arrayBuffer();
    const text = Buffer.from(buffer).toString('utf-8');

    const parsed = await xml2js.parseStringPromise(text, { explicitArray: false });
    let items = parsed?.PIES?.Items?.Item || [];
    items = Array.isArray(items) ? items : [items];

    res.write(`✅ Catalog saved\n`);
    res.write(`Total products identified: ${items.length}\n`);

    const optimizedProducts = [];
    const optimizationLimit = optimizeAll ? items.length : 10;

    for (let i = 0; i < optimizationLimit; i++) {
      const optimizedProduct = await optimizeProduct(items[i]);
      optimizedProducts.push(optimizedProduct);

      res.write(`⏳ SEO Optimizing... (Current ${i + 1}/${optimizationLimit})\r`);
    }

    const seoFileName = `seo-optimized-catalog-${Date.now()}.json`;
    await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .upload(`seo/${seoFileName}`, JSON.stringify(optimizedProducts, null, 2), {
        contentType: 'application/json',
        upsert: true,
      });

    res.write(`\n✅ SEO optimization completed (${optimizationLimit}/${optimizationLimit})\n`);
    res.write(`✅ Optimized catalog saved as: ${seoFileName}\n`);

    // Trigger background reintegration if optimizeAll is true
    if (optimizeAll) {
      // Background process for reintegration would be initiated here
    }

    res.end();
  } catch (error) {
    console.error('SEO optimization error:', error);
    res.status(500).end(`SEO optimization failed: ${error.message}`);
  }
}
