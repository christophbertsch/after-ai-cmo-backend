import { createClient } from '@supabase/supabase-js';
import { IncomingForm } from 'formidable';
import fs from 'fs';

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://after-ai-cmo-dq14.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const form = new IncomingForm();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Form parsing failed:', err);
      return res.status(500).json({ message: 'Form parsing failed.' });
    }

    const file = files.file[0] || files.file;
    const filePath = file.filepath || file.path;

    if (!filePath) {
      return res.status(400).json({ message: 'Uploaded file path missing.' });
    }

    const fileStream = fs.createReadStream(filePath);
    const originalFileName = file.originalFilename || file.newFilename || file.name;
    const safeFileName = originalFileName.replace(/[^a-zA-Z0-9.-_]/g, "_");

    try {
      const { data, error } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .upload(`uploads/${safeFileName}`, fileStream, {
          contentType: file.mimetype,
          cacheControl: '3600',
          upsert: true,
          duplex: 'half'
        });

      fs.unlink(filePath, () => {}); // Clean up temp file asynchronously

      if (error) {
        console.error('Supabase upload error:', error);
        return res.status(500).json({ message: 'Supabase upload failed.', error: error.message });
      }

      return res.status(200).json({ message: '✅ Catalog uploaded successfully!', path: data.path });

    } catch (uploadError) {
      console.error('Unexpected error:', uploadError);
      fs.unlink(filePath, () => {});
      return res.status(500).json({ message: 'Unexpected error during upload.' });
    }
  });
}
