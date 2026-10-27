const admin = require('firebase-admin');

if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const body = JSON.parse(event.body);
        const { order, transaction } = body;

        if (transaction.status === 'SUCCESS') {
            const depositsRef = db.collection('deposits');
            const snapshot = await depositsRef.where('invoice', '==', order.invoice_number).get();
            
            if (!snapshot.empty) {
                snapshot.forEach(async (doc) => {
                    await doc.ref.update({ 
                        status: "Pending Admin", 
                        metode: transaction.payment_method 
                    });
                });
            }
        }
        return { statusCode: 200, body: 'OK' };
    } catch (error) {
        console.error("Webhook Error: ", error);
        return { statusCode: 500, body: 'Error' };
    }
};
