import { IncomingForm } from 'formidable';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', 'https://after-ai-cmo-dq14.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization');

  // Preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const form = new IncomingForm({ multiples: false, keepExtensions: true, uploadDir: '/tmp' });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Formidable parsing error:', err);
      return res.status(500).json({ message: 'Upload failed during file parse' });
    }

    const file = files.file;

    if (!file) {
      console.error('No file received!');
      return res.status(400).json({ message: 'No file received!' });
    }

    const filePath = file.filepath || file.path;

    if (!filePath) {
      console.error('No filePath found!');
      return res.status(500).json({ message: 'Uploaded file is missing path' });
    }

    try {
      const { data, error } = await supabase
        .storage
        .from(process.env.SUPABASE_BUCKET)
        .upload(`uploads/${file.originalFilename}`, fs.createReadStream(filePath), {
          contentType: file.mimetype,
        });

      if (error) {
        console.error('Supabase upload error:', error);
        return res.status(500).json({ message: 'Supabase upload failed' });
      }

      res.status(200).json({ message: '✅ Upload successful!' });
    } catch (err) {
      console.error('Supabase upload exception:', err);
      res.status(500).json({ message: 'Upload failed' });
    }
  });
}
