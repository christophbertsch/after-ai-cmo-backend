import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { filename } = req.body;
  if (!filename) return res.status(400).json({ message: 'Missing filename' });

  const { data, error } = await supabase.storage
    .from(process.env.SUPABASE_BUCKET)
    .createSignedUploadUrl(`uploads/${filename}`);

  if (error) return res.status(500).json({ message: 'Failed to generate signed URL' });

  res.status(200).json({ signedUrl: data.signedUrl });
}
