const express = require('express');
const { google } = require('googleapis');

const app = express();
app.use(express.json());

// ✅ Duplicate prevention
const processedEvents = new Set();

async function addToSheet(data) {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: '1jM9t52-UCrSGclRdem6SX0xG0dUQi3bQeWUuuXQhu2I',
    range: 'Sheet1!A:G',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        data.orderId,
        data.name,
        data.phone,
        data.email,
        data.product,
        data.amount,
        data.date
      ]]
    }
  });
}

app.post('/sheet', async (req, res) => {
  try {
    const body = req.body;

    // =========================
    // 🔥 RAZORPAY WEBHOOK
    // =========================
    if (body.event && body.payload) {

      const eventId = body.payload?.payment?.entity?.id;

      if (!eventId) return res.sendStatus(200);

      if (processedEvents.has(eventId)) {
        console.log("Duplicate skipped:", eventId);
        return res.sendStatus(200);
      }

      processedEvents.add(eventId);

      const payment = body.payload.payment.entity;

      const data = {
        orderId: payment.order_id || payment.id,
        name: payment.notes?.name || "No Name",
        phone: payment.contact || "No Phone",
        email: payment.email || "No Email",
        product: payment.notes?.product || "Razorpay Product",
        amount: payment.amount ? payment.amount / 100 : 0,
        date: new Date(payment.created_at * 1000).toISOString()
      };

      console.log("Razorpay Event:", data);

      await addToSheet(data);
    }

    // =========================
    // 🔥 SHOPIFY WEBHOOK
    // =========================
    else {

      const orderId = body.id || body.token;

      if (!orderId) return res.sendStatus(200);

      if (processedEvents.has(orderId)) {
        console.log("Duplicate skipped:", orderId);
        return res.sendStatus(200);
      }

      processedEvents.add(orderId);

      const data = {
        orderId: orderId,

        name:
          body.customer?.first_name ||
          body.shipping_address?.name ||
          "No Name",

        phone:
          body.customer?.phone ||
          body.shipping_address?.phone ||
          body.billing_address?.phone ||
          "No Phone",

        email: body.email || "No Email",

        product:
          body.line_items && body.line_items.length > 0
            ? body.line_items.map(item => item.name).join(", ")
            : "No Product",

        amount:
          body.total_price ||
          body.subtotal_price ||
          "0",

        date: body.created_at
      };

      console.log("Shopify Order:", data);

      await addToSheet(data);
    }

    res.sendStatus(200);

  } catch (err) {
    console.error("ERROR:", err);
    res.sendStatus(500);
  }
});

// ✅ Health check
app.get('/', (req, res) => {
  res.send("Server running");
});

// ✅ Render port fix
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server started on", PORT));