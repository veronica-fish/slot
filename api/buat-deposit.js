const axios = require('axios');
const crypto = require('crypto');
const admin = require('firebase-admin');

// Inisialisasi Firebase (membaca Environment Variable Vercel)
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

module.exports = async (req, res) => {
    // Izinkan CORS agar Frontend bisa memanggil API ini
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { nominal, userId, username } = req.body;
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
        
        // Generate Signature Doku
        const digest = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('base64');
        const component = `Client-Id:${DOKU_CLIENT_ID}\nRequest-Id:${requestId}\nRequest-Timestamp:${timestamp}\nRequest-Target:${target}\nDigest:${digest}`;
        const signature = crypto.createHmac('sha256', DOKU_SECRET_KEY).update(component).digest('base64');

        // Tembak API Doku
        const response = await axios.post(`https://api.doku.com${target}`, payload, {
            headers: {
                'Client-Id': DOKU_CLIENT_ID,
                'Request-Id': requestId,
                'Request-Timestamp': timestamp,
                'Signature': `HMACSHA256=${signature}`,
                'Content-Type': 'application/json'
            }
        });

        // Simpan tagihan ke Firestore (Status Pending)
        await db.collection('deposits').add({
            uid: userId, 
            username: username, 
            nominal: nominal, 
            metode: "Doku",
            status: "Pending", 
            invoice: invoiceNumber, 
            tanggal: admin.firestore.FieldValue.serverTimestamp()
        });

        return res.status(200).json({ url: response.data.response.payment.url });
    } catch (error) {
        console.error("Doku Error: ", error.response ? error.response.data : error.message);
        return res.status(500).json({ error: "Gagal memproses ke Doku" });
    }
};
