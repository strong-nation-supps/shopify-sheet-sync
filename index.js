const express = require('express');
const { google } = require('googleapis');

const app = express();
app.use(express.json());

// 🔥 Duplicate prevention
const processedIds = new Set();

// 🔥 Google Sheet Function
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

    // 🔴 RAZORPAY
    if (body.event && body.payload) {
      const payment = body.payload.payment?.entity;
      if (!payment) return res.sendStatus(200);

      const uniqueId = payment.id; // 🔥 unique

      if (processedIds.has(uniqueId)) {
        console.log("Duplicate Razorpay skipped:", uniqueId);
        return res.sendStatus(200);
      }

      processedIds.add(uniqueId);

      const data = {
        orderId: payment.order_id || payment.id,
        name: payment.notes?.name || payment.email?.split("@")[0] || "No Name",
        phone: payment.contact || "No Phone",
        email: payment.email || "No Email",
        product: payment.notes?.product || "Strong Nation Product",
        amount: payment.amount / 100,
        date: new Date(payment.created_at * 1000).toISOString()
      };

      console.log("Razorpay Event:", data);
      await addToSheet(data);
    }

    // 🟢 SHOPIFY
    else {
      const uniqueId = body.id; // 🔥 unique order id

      if (processedIds.has(uniqueId)) {
        console.log("Duplicate Shopify skipped:", uniqueId);
        return res.sendStatus(200);
      }

      processedIds.add(uniqueId);

      const data = {
        orderId: body.id || "No ID",
        name: `${body.customer?.first_name || ""} ${body.customer?.last_name || ""}`.trim() || "No Name",
        phone: body.customer?.phone || "No Phone",
        email: body.email || "No Email",
        product: body.line_items?.map(i => i.name).join(", ") || "No Product",
        amount: body.total_price || "0",
        date: body.created_at || new Date().toISOString()
      };

      console.log("Shopify Event:", data);
      await addToSheet(data);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("ERROR:", err);
    res.sendStatus(500);
  }
});

// Health check
app.get('/', (req, res) => {
  res.send("Server running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server started on", PORT));