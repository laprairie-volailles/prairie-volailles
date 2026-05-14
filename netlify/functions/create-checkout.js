const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { items, customer, delivery } = JSON.parse(event.body);

    // Construire les articles pour Stripe
    const lineItems = items.map(item => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: `${item.emoji || ''} ${item.name}`.trim(),
          description: `${item.qty} kg`,
        },
        unit_amount: Math.round(item.price * item.qty * 100), // en centimes
      },
      quantity: 1,
    }));

    // Créer la session Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      customer_email: customer.email || undefined,
      metadata: {
        prenom:        (customer.prenom   || '').substring(0, 100),
        nom:           (customer.nom      || '').substring(0, 100),
        telephone:     (customer.telephone|| '').substring(0, 50),
        email:         (customer.email    || '').substring(0, 100),
        mode_livraison:(delivery.mode     || '').substring(0, 20),
        adresse:       (delivery.adresse  || '').substring(0, 200),
        creneau:       (delivery.creneau  || '').substring(0, 100),
        notes:         (delivery.notes    || '').substring(0, 400),
      },
      success_url: `${process.env.URL}/success.html`,
      cancel_url:  `${process.env.URL}/cancel.html`,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };

  } catch (error) {
    console.error('Stripe error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
