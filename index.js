const express = require('express');
const { google } = require('googleapis');

const app = express();
app.use(express.json());

// ================= GOOGLE SHEET FUNCTION =================
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

// ================= WEBHOOK =================
app.post('/sheet', async (req, res) => {
  try {
    const body = req.body;

    console.log("RAW WEBHOOK:", JSON.stringify(body));

    // ================= RAZORPAY =================
    if (body.event && body.payload && body.payload.payment) {

      const payment = body.payload.payment.entity;

      const data = {
        orderId: payment.order_id || payment.id || "No Order ID",

        // 🔥 IMPORTANT: ye tabhi aayega jab frontend se notes pass karega
        name: payment.notes?.name || "No Name",

        phone: payment.contact || "No Phone",

        email: payment.email || "No Email",

        product: payment.notes?.product || "No Product",

        amount: payment.amount ? payment.amount / 100 : 0,

        date: payment.created_at
          ? new Date(payment.created_at * 1000).toLocaleString()
          : new Date().toLocaleString()
      };

      console.log("FINAL DATA:", data);

      await addToSheet(data);
    }

    res.sendStatus(200);

  } catch (err) {
    console.error("ERROR:", err);
    res.sendStatus(500);
  }
});

// ================= HEALTH CHECK =================
app.get('/', (req, res) => {
  res.send("Server running");
});

// ================= PORT FIX =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server started on", PORT));