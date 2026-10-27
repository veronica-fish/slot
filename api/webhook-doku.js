const admin = require('firebase-admin');

if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { order, transaction } = req.body;

        // Jika Doku bilang pembayaran SUKSES
        if (transaction.status === 'SUCCESS') {
            const depositsRef = db.collection('deposits');
            const snapshot = await depositsRef.where('invoice', '==', order.invoice_number).get();
            
            if (!snapshot.empty) {
                snapshot.forEach(async (doc) => {
                    // Ubah status jadi "Pending Admin" agar admin bisa cek & setujui
                    await doc.ref.update({ 
                        status: "Pending Admin", 
                        metode: transaction.payment_method 
                    });
                });
            }
        }
        // Wajib membalas OK agar Doku tahu pesan diterima
        return res.status(200).send('OK');
    } catch (error) {
        console.error("Webhook Error: ", error);
        return res.status(500).send('Error');
    }
};
