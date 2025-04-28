import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

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
    const { filename, contentType } = req.body;

    if (!filename || !contentType) {
      return res.status(400).json({ message: 'Missing filename or contentType' });
    }

    const { data, error } = await supabase
      .storage
      .from(process.env.SUPABASE_BUCKET)
      .createSignedUploadUrl(`uploads/${filename}`);

    if (error) {
      console.error('Signed URL error:', error);
      return res.status(500).json({ message: 'Failed to generate signed URL' });
    }

    res.status(200).json({ signedUrl: data.signedUrl });
  } catch (error) {
    console.error('Signed URL generation error:', error);
    res.status(500).json({ message: error.message });
  }
}
