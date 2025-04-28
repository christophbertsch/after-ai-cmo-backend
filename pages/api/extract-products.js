import { parseCatalog } from '../../utils/catalogParser';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });

  try {
    const fileUrl = 'YOUR_SUPABASE_FILE_URL'; // you must define or fetch the latest file path here

    const response = await fetch(fileUrl, { duplex: 'half' }); // <-- FIXED HERE
    const xmlContent = await response.text();
    const products = await parseCatalog(xmlContent);

    res.status(200).json({
      message: '✅ Products extracted successfully!',
      totalProducts: products.length,
    });
  } catch (error) {
    console.error('Error extracting products:', error);
    res.status(500).json({ message: 'Failed to extract products.', error: error.message });
  }
}
