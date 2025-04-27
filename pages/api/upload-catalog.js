import { createClient } from '@supabase/supabase-js';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';
import xml2js from 'xml2js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function parseXMLFile(filePath) {
  const xml = fs.readFileSync(filePath, 'utf-8');
  const parser = new xml2js.Parser();
  const result = await parser.parseStringPromise(xml);
  return result;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const form = new IncomingForm({ multiples: false });
  form.uploadDir = '/tmp';
  form.keepExtensions = true;

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Upload failed' });
    }

    const file = files.file;
    const tempPath = file.filepath;

    console.log('Parsing uploaded file:', file.originalFilename);

    try {
      const parsedData = await parseXMLFile(tempPath);

      // Example: parse articles from BMEcat
      const articles = parsedData?.BMECAT?.T_NEW_CATALOG?.[0]?.ARTICLE || [];
      const total = articles.length;

      let processed = 0;

      for (const article of articles) {
        processed++;

        if (processed % 50 === 0 || processed === total) {
          console.log(`Processed ${processed} of ${total} products`);
        }

        // Here you could upload each product info to Supabase, Airtable, etc.
      }

      return res.status(200).json({ message: `Uploaded successfully! Processed ${total} products.` });
    } catch (error) {
      console.error('Parsing error:', error);
      return res.status(500).json({ message: 'Error parsing XML' });
    }
  });
}
