import formidable from 'formidable';
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

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const form = new formidable.IncomingForm({ multiples: false });
  form.uploadDir = '/tmp';
  form.keepExtensions = true;

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Upload failed' });
    }

    const file = files.file;
    const tempPath = file.filepath;

    const { data, error } = await supabase
      .storage
      .from(process.env.SUPABASE_BUCKET)
      .upload(file.originalFilename, fs.createReadStream(tempPath), {
        contentType: file.mimetype,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return res.status(500).json({ message: 'Supabase upload failed' });
    }

    res.status(200).json({ message: 'Upload successful!' });
  });
}
