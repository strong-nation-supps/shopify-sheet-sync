const express = require('express');
const { google } = require('googleapis');

const app = express();
app.use(express.json());

// 🔥 Duplicate prevention (memory)
const processedOrders = new Set();

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
    const checkout = req.body;

    const orderId = checkout.id; // 🔥 checkout id

    // ❌ Duplicate check
    if (processedOrders.has(orderId)) {
      console.log("Duplicate skipped:", orderId);
      return res.sendStatus(200);
    }

    processedOrders.add(orderId);

    // ✅ Correct mapping for CHECKOUT webhook
    const data = {
      orderId: orderId,
      name: checkout.shipping_address?.first_name || "No Name",
      phone: checkout.phone || "No Phone",
      email: checkout.email || "No Email",
      product: checkout.line_items?.[0]?.title || "No Product",
      amount: checkout.total_price || "0",
      date: checkout.created_at
    };

    console.log("New Checkout:", data);

    await addToSheet(data);

    res.sendStatus(200);
  } catch (err) {
    console.error("Error:", err);
    res.sendStatus(500);
  }
});

// Health check
app.get('/', (req, res) => {
  res.send("Server running");
});

// 🔥 Render compatible PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server started on port ${PORT}`);
});