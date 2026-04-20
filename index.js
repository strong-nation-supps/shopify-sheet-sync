const express = require('express');
const { google } = require('googleapis');

const app = express();
app.use(express.json());

// ✅ Duplicate prevention using unique event id
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

    // 🔥 Razorpay webhook
    if (body.event && body.payload) {

      const eventId = body.payload?.payment?.entity?.id;

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
        amount: payment.amount / 100, // paise to rupees
        date: payment.created_at
      };

      console.log("Razorpay Event:", data);

      await addToSheet(data);
    }

    // 🔥 Shopify webhook
    else {
      const orderId = body.id;

      if (processedEvents.has(orderId)) {
        console.log("Duplicate skipped:", orderId);
        return res.sendStatus(200);
      }

      processedEvents.add(orderId);

      const data = {
        orderId: orderId,
        name: body.customer?.first_name || "No Name",
        phone: body.customer?.phone || "No Phone",
        email: body.email || "No Email",
        product: body.line_items?.[0]?.name || "No Product",
        amount: body.total_price || "0",
        date: body.created_at
      };

      console.log("Shopify Order:", data);

      await addToSheet(data);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// Health check
app.get('/', (req, res) => {
  res.send("Server running");
});

// ✅ IMPORTANT: Render dynamic port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server started on", PORT));

//finish