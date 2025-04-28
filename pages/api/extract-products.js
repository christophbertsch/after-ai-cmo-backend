import { parseCatalog } from '../../utils/catalogParser';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });

  try {
    // Assume latest uploaded file
    const filePath = 'path/to/your/local/file/or/bucket-download'; // adjust depending where you fetch it
    const products = await parseCatalog(filePath);

    res.status(200).json({
      message: '✅ Products extracted successfully!',
      totalProducts: products.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to extract products.' });
  }
}
