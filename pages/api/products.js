// File: /api/products.js
export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      // Fetch basic product info from Qdrant
      const products = await fetchBasicProductsFromQdrant();  // your function to fetch from Qdrant

      res.status(200).json(products);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
