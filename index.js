const express = require('express');
const { google } = require('googleapis');

const app = express();
app.use(express.json());

// 🔥 Duplicate prevention (temporary memory)
const processedOrders = new Set();

async function addToSheet(data) {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: '1jM9t52-UCrSGclRdem6SX0xG0dUQi3bQeWUuuXQhu2I',
    range: 'Sheet1!A:G', // 👈 Order ID added
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
    const order = req.body;

    const orderId = order.id; // 🔥 Unique ID

    // ❌ Duplicate check
    if (processedOrders.has(orderId)) {
      console.log("Duplicate skipped:", orderId);
      return res.sendStatus(200);
    }

    processedOrders.add(orderId);

    const data = {
      orderId: orderId,
      name: order.customer?.first_name || "No Name",
      phone: order.customer?.phone || "No Phone",
      email: order.email || "No Email",
      product: order.line_items?.[0]?.name || "No Product",
      amount: order.total_price || "0",
      date: order.created_at
    };

    console.log("New Order:", data);

    await addToSheet(data);

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

app.listen(3000, () => console.log("Server started"));