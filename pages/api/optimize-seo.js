// optimize-seo.js
import { createClient } from '@supabase/supabase-js';
import { detectCatalogType } from '../../utils/detectCatalogType';
import { parsePIESCatalog } from '../../utils/piesParser';
import { parseBMEcatCatalog } from '../../utils/bmecatParser';
import { parseBMEcatETIMCatalog } from '../../utils/bmecatEtimParser';
import { parseBMEcat2005Catalog } from '../../utils/bmecat2005Parser';
import OpenAI from 'openai';
import { QdrantClient } from '@qdrant/js-client-rest';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const qdrant = new QdrantClient({ url: process.env.QDRANT_URL, apiKey: process.env.QDRANT_API_KEY });

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

    const generateEmbedding = async (text) => {
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });
      return embeddingResponse.data[0].embedding;
    };

    const optimizedProducts = [];

    for (const product of products.slice(0, optimizeAll ? products.length : 10)) {
      const embedding = await generateEmbedding(product.OriginalDescription);
      const result = await qdrant.search('after_ai_products', { vector: embedding, limit: 1 });

      optimizedProducts.push({
        ...product,
        OptimizedDescription: result.length ? result[0].payload.optimizedDescription : product.OriginalDescription,
      });
    }

    const seoFileName = `optimized-catalog-${Date.now()}.json`;
    await supabase.storage.from(process.env.SUPABASE_BUCKET).upload(`optimized/${seoFileName}`, JSON.stringify(optimizedProducts, null, 2), {
      contentType: 'application/json',
      cacheControl: '3600',
      upsert: true,
    });

    await supabase.from('optimized_products').insert(
      optimizedProducts.map((p) => ({
        product_id: p.ProductID,
        original_description: p.OriginalDescription,
        optimized_description: p.OptimizedDescription,
        manufacturer: p.Manufacturer,
        gtin: p.GTIN,
        hazardous_material: p.HazardousMaterial,
        extended_information: p.ExtendedInformation,
        product_attributes: p.ProductAttributes,
        part_interchange_info: p.PartInterchangeInfo,
        digital_assets: p.DigitalAssets,
      }))
    );

    res.status(200).json({
      seo: optimizedProducts,
      report: {
        totalProducts: products.length,
        optimizedCount: optimizedProducts.length,
        optimizedFile: seoFileName,
      },
    });
  } catch (error) {
    console.error('SEO optimization error:', error);
    res.status(500).json({ message: 'SEO optimization failed', error: error.message });
  }
}
