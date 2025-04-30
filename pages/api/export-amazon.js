// export-amazon.js
import { createClient } from '@supabase/supabase-js';
import { Parser } from 'json2csv';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'text/csv');

  try {
    const { data, error } = await supabase.from('optimized_products').select('*').limit(500);
    if (error) throw error;

    const rows = data.map((p) => {
      const bullets = Array.isArray(p.product_attributes)
        ? p.product_attributes.slice(0, 5).map(attr => `${attr.FeatureName}: ${attr.FeatureValue}`)
        : [];

      return {
        SKU: p.product_id,
        product_type: 'auto_parts',
        brand_name: p.manufacturer,
        item_name: p.optimized_description,
        product_description: p.extended_information || p.optimized_description,
        external_product_id: p.gtin,
        external_product_id_type: 'EAN',
        update_delete: 'Update',
        standard_price: p.suggested_price?.replace(/[^\d.]/g, '') || '',
        quantity: 0,
        main_image_url: Array.isArray(p.digital_assets) ? p.digital_assets[0]?.URL || '' : '',
        bullet_point1: bullets[0] || '',
        bullet_point2: bullets[1] || '',
        bullet_point3: bullets[2] || '',
        bullet_point4: bullets[3] || '',
        bullet_point5: bullets[4] || '',
      };
    });

    const parser = new Parser({ fields: Object.keys(rows[0]) });
    const csv = parser.parse(rows);

    res.setHeader('Content-Disposition', 'attachment; filename=amazon_export.csv');
    res.status(200).send(csv);
  } catch (error) {
    console.error('Amazon export error:', error);
    res.status(500).json({ message: 'Export failed', error: error.message });
  }
}
