const axios = require('axios');
const crypto = require('crypto');
const admin = require('firebase-admin');

// Inisialisasi Firebase
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

exports.handler = async function(event, context) {
    // Handle CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

    try {
        const body = JSON.parse(event.body);
        const { nominal, userId, username } = body;
        const invoiceNumber = "INV-" + Date.now();
        
        const DOKU_CLIENT_ID = process.env.DOKU_CLIENT_ID;
        const DOKU_SECRET_KEY = process.env.DOKU_SECRET_KEY;

        const payload = {
            order: { amount: nominal, invoice_number: invoiceNumber },
            payment: { payment_due_date: 60 },
            customer: { id: userId, name: username }
        };

        const requestId = crypto.randomUUID();
        const timestamp = new Date().toISOString();
        const target = "/checkout/v1/payment";
        
        const digest = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('base64');
        const component = `Client-Id:${DOKU_CLIENT_ID}\nRequest-Id:${requestId}\nRequest-Timestamp:${timestamp}\nRequest-Target:${target}\nDigest:${digest}`;
        const signature = crypto.createHmac('sha256', DOKU_SECRET_KEY).update(component).digest('base64');

        const response = await axios.post(`https://api.doku.com${target}`, payload, {
            headers: {
                'Client-Id': DOKU_CLIENT_ID,
                'Request-Id': requestId,
                'Request-Timestamp': timestamp,
                'Signature': `HMACSHA256=${signature}`,
                'Content-Type': 'application/json'
            }
        });

        await db.collection('deposits').add({
            uid: userId, username: username, nominal: nominal, metode: "Doku",
            status: "Pending", invoice: invoiceNumber, tanggal: admin.firestore.FieldValue.serverTimestamp()
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ url: response.data.response.payment.url })
        };
    } catch (error) {
        console.error("Doku Error: ", error.response ? error.response.data : error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: "Gagal memproses ke Doku" })
        };
    }
};
