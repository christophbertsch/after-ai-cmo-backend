// api/upload-catalog.js
import { createClient } from '@supabase/supabase-js';
const formidable = require('formidable');
const fs = require('fs');

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Parsing error:', err);
      return res.status(500).json({ message: 'Form parsing failed.' });
    }

    const file = files.file[0] || files.file;
    const filePath = file.filepath || file.path;

    if (!filePath) {
      console.error('No filePath found!');
      return res.status(500).json({ message: 'Uploaded file is missing path' });
    }

    const { data, error } = await supabase
      .storage
      .from(process.env.SUPABASE_BUCKET)
      .upload(`uploads/${file.originalFilename}`, fs.createReadStream(filePath), {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return res.status(500).json({ message: error.message });
    }

    return res.status(200).json({ message: 'Uploaded successfully!', path: data.path });
  });
}
