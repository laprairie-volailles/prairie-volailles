const stripe    = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');

exports.handler = async (event) => {
  // Vérifier la signature Stripe
  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // Traiter uniquement les paiements confirmés
  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const meta    = session.metadata;
    const total   = (session.amount_total / 100).toFixed(2).replace('.', ',');

    // Récupérer le détail des articles
    const lineItemsData = await stripe.checkout.sessions.listLineItems(session.id);
    const lignes = lineItemsData.data.map(item =>
      `• ${item.description} — ${(item.amount_total / 100).toFixed(2).replace('.', ',')} €`
    ).join('\n');

    const modeTexte = meta.mode_livraison === 'retrait'
      ? '🏪 Retrait au marché (avant 14h30)'
      : '🚚 Livraison à domicile';

    // Contenu de l'email
    const html = `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;border:1px solid #eee;">
        <div style="background:#7A1E2E;padding:1.5rem 2rem;">
          <h2 style="color:#F8F0DC;margin:0;font-size:1.4rem;">🥩 Nouvelle commande</h2>
          <p style="color:#C4963A;margin:0.3rem 0 0;font-size:0.95rem;">La Prairie des Volailles</p>
        </div>
        <div style="padding:2rem;">
          <h3 style="color:#7A1E2E;border-bottom:1px solid #eee;padding-bottom:0.5rem;">👤 Client</h3>
          <p style="margin:0.5rem 0;"><strong>Nom :</strong> ${meta.prenom} ${meta.nom}</p>
          <p style="margin:0.5rem 0;"><strong>Téléphone :</strong> ${meta.telephone}</p>
          <p style="margin:0.5rem 0;"><strong>Email :</strong> ${meta.email || 'Non renseigné'}</p>

          <h3 style="color:#7A1E2E;border-bottom:1px solid #eee;padding-bottom:0.5rem;margin-top:1.5rem;">📦 Mode de réception</h3>
          <p style="margin:0.5rem 0;">${modeTexte}</p>
          ${meta.adresse ? `<p style="margin:0.5rem 0;"><strong>Adresse :</strong> ${meta.adresse}</p>` : ''}
          ${meta.creneau ? `<p style="margin:0.5rem 0;"><strong>Créneau :</strong> ${meta.creneau}</p>` : ''}

          <h3 style="color:#7A1E2E;border-bottom:1px solid #eee;padding-bottom:0.5rem;margin-top:1.5rem;">🛒 Produits commandés</h3>
          <pre style="background:#f9f5ec;padding:1rem;font-size:0.95rem;line-height:1.7;">${lignes}</pre>

          <div style="background:#7A1E2E;color:white;padding:1rem 1.5rem;margin-top:1rem;">
            <strong style="font-size:1.2rem;">💶 Total payé : ${total} €</strong>
          </div>

          ${meta.notes ? `
          <h3 style="color:#7A1E2E;border-bottom:1px solid #eee;padding-bottom:0.5rem;margin-top:1.5rem;">📝 Instructions</h3>
          <p style="margin:0.5rem 0;">${meta.notes}</p>
          ` : ''}

          <p style="color:#999;font-size:0.85rem;margin-top:2rem;border-top:1px solid #eee;padding-top:1rem;">
            ✅ Paiement confirmé et sécurisé par Stripe · ID : ${session.id}
          </p>
        </div>
      </div>
    `;

    // Envoyer l'email via Gmail
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"La Prairie des Volailles" <${process.env.GMAIL_USER}>`,
      to:   process.env.SHOP_EMAIL,
      subject: `🥩 Nouvelle commande — ${meta.prenom} ${meta.nom} — ${total} €`,
      html,
    });

    console.log(`Email envoyé pour la commande de ${meta.prenom} ${meta.nom}`);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ received: true }),
  };
};
