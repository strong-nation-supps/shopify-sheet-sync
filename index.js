const express = require('express');
const { google } = require('googleapis');

const app = express();
app.use(express.json());

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

// 🔥 MAIN WEBHOOK
app.post('/sheet', async (req, res) => {
  try {
    const body = req.body;

    // ===========================
    // 🔴 RAZORPAY WEBHOOK
    // ===========================
    if (body.event && body.payload) {

      const payment = body.payload.payment?.entity;

      if (!payment) return res.sendStatus(200);

      const data = {
        orderId: payment.order_id || payment.id,

        // 🔥 FIXED NAME
        name:
          payment.notes?.name ||
          payment.email?.split("@")[0] ||
          "No Name",

        // 🔥 PHONE
        phone: payment.contact || "No Phone",

        // 🔥 EMAIL
        email: payment.email || "No Email",

        // 🔥 FIXED PRODUCT
        product:
          payment.notes?.product ||
          "Strong Nation Product",

        // 🔥 AMOUNT (paise → ₹)
        amount: payment.amount / 100,

        // 🔥 DATE FIX
        date: new Date(payment.created_at * 1000).toISOString()
      };

      console.log("Razorpay Event:", data);

      await addToSheet(data);
    }

    // ===========================
    // 🟢 SHOPIFY WEBHOOK
    // ===========================
    else {

      const data = {
        orderId: body.id || "No ID",

        name:
          body.customer?.first_name +
            " " +
            body.customer?.last_name ||
          "No Name",

        phone: body.customer?.phone || "No Phone",

        email: body.email || "No Email",

        product:
          body.line_items
            ?.map(item => item.name)
            .join(", ") || "No Product",

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

// 🔥 HEALTH CHECK
app.get('/', (req, res) => {
  res.send("Server running");
});

// 🔥 PORT FIX (Render ke liye)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server started on", PORT));