// webhooks.js
import stripe from '../../utils/stripe';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const buf = await req.text();
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerEmail = session.customer_email;
    // Optional: Update user record or subscription table
    console.log(`Stripe subscription active for ${customerEmail}`);
  }

  res.status(200).end();
}
