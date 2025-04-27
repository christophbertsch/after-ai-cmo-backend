export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://after-ai-cmo-dq14.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ message: 'Message is required.' });
      }
      res.status(200).json({ reply: `You said: ${message}` });
    } catch (error) {
      res.status(400).json({ message: 'Invalid request body.' });
    }
  } else {
    res.status(405).json({ message: 'Method Not Allowed' });
  }
}
