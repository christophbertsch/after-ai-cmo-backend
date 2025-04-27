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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://after-ai-cmo-dq14.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  try {
    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .list('uploads', { limit: 1, sortBy: { column: 'created_at', order: 'desc' } });

    if (error || !data.length) return res.status(404).json({ message: 'No files found.' });

    const latestFile = data[0];
    const fileUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_BUCKET}/uploads/${latestFile.name}`;
    const response = await fetch(fileUrl, { duplex: 'half' });

    const buffer = await response.arrayBuffer();
    const text = Buffer.from(buffer).toString('utf-8');

    const parsed = await xml2js.parseStringPromise(text, { explicitArray: false });

    let items = parsed?.PIES?.Items?.Item || [];
    items = Array.isArray(items) ? items : [items];

    console.log('Parsed items count:', items.length); // Debugging line explicitly added

    const optimizedProducts = [];

    for (const item of items) {
      const originalDesc = `${item.PartTerminologyID || ''} ${item.Description || ''} ${item.ExtendedInformation || ''}`.trim();
      const embedding = await generateEmbedding(originalDesc);

      const searchResult = await qdrant.search('after_ai_products', {
        vector: embedding,
        limit: 1,
      });

      const optimizedDescription = searchResult.length
        ? searchResult[0].payload.optimizedDescription
        : originalDesc;

      optimizedProducts.push({
        ProductID: item.PartNumber || '',
        OriginalDescription: originalDesc,
        OptimizedDescription: optimizedDescription,
        Manufacturer: item.BrandLabel || '',
      });
    }

    const seoFileName = `seo-optimized-catalog-${Date.now()}.json`;
    const { error: uploadError } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .upload(`seo/${seoFileName}`, JSON.stringify(optimizedProducts, null, 2), {
        contentType: 'application/json',
        duplex: 'half',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    res.status(200).json({
      seo: optimizedProducts,
      report: {
        totalProducts: optimizedProducts.length,
        changesMade: optimizedProducts.length,
        optimizedFile: seoFileName,
      },
    });
  } catch (error) {
    console.error('SEO optimization error:', error);
    res.status(500).json({ message: 'SEO optimization failed', error: error.message });
  }
}
