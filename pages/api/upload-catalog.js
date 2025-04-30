import { createClient } from '@supabase/supabase-js';
import { IncomingForm } from 'formidable';
import fs from 'fs';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const form = new IncomingForm();

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ message: 'Parsing failed' });

    const file = files.file[0] || files.file;
    const filePath = file.filepath || file.path;
    const safeFileName = (file.originalFilename || 'upload.xml').replace(/[^a-zA-Z0-9.-_]/g, '_');
    const fileStream = fs.createReadStream(filePath);

    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .upload(`uploads/${safeFileName}`, fileStream, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: true,
      });

    if (error) return res.status(500).json({ message: error.message });

    res.status(200).json({ message: 'Uploaded successfully!', path: data.path });
  });
}
