const express = require('express');
const { google } = require('googleapis');

const app = express();
app.use(express.json());

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

    // 🔥 Razorpay Webhook
    if (body.event && body.payload) {

      const payment = body.payload.payment?.entity;

      const data = {
        orderId: payment?.order_id || payment?.id || "No ID",
        name: payment?.notes?.name || "No Name",
        phone: payment?.contact || "No Phone",
        email: payment?.email || "No Email",
        product: payment?.notes?.product || "Razorpay Product",
        amount: payment?.amount ? payment.amount / 100 : "0",
        date: payment?.created_at || new Date().toISOString()
      };

      console.log("Razorpay Event:", data);

      await addToSheet(data);
    }

    // 🔥 Shopify Webhook
    else {

      const data = {
        orderId: body.id || "No ID",
        name: body.customer?.first_name || "No Name",
        phone: body.phone || body.customer?.phone || "No Phone",
        email: body.email || "No Email",
        product: body.line_items?.map(i => i.name).join(", ") || "No Product",
        amount: body.total_price || "0",
        date: body.created_at || new Date().toISOString()
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

// ✅ Render port fix
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server started on", PORT));