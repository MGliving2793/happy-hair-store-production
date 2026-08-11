const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const prisma = require('../db');
const authMiddleware = require('../middlewares/auth.middleware');
const { finalizePaidOrder } = require('../controllers/order.controller');

const MERCHANT_UPI_ID = process.env.MERCHANT_UPI_ID || '';
const MERCHANT_NAME = process.env.MERCHANT_NAME || 'Happy Hair';

function paymentData(order) {
  try { return JSON.parse(order.payment_receipt || '{}'); } catch { return {}; }
}
function savePaymentData(data) { return JSON.stringify(data); }

router.get('/upi-config', (req, res) => {
  res.json({ active: Boolean(MERCHANT_UPI_ID), upi_id: MERCHANT_UPI_ID, merchant_name: MERCHANT_NAME });
});

router.get('/checkout/:orderId', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: Number(req.params.orderId) } });
    if (!order) return res.status(404).send('Order not found');
    if (['PAID','PROCESSING','SHIPPED','DELIVERED'].includes(order.status)) return res.redirect(`/api/orders/status/${order.id}`);

    const keyId = process.env.RAZORPAY_KEY_ID;
    const data = paymentData(order);
    const manual = !keyId || !data.gatewayOrderId;
    const safeTotal = Number(order.total).toFixed(2);
    const safeName = String(order.customer_name).replace(/[<>]/g, '');

    if (manual) {
      return res.type('html').send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment | ${MERCHANT_NAME}</title><style>body{font-family:Arial;background:#f7f3ea;padding:24px}.card{max-width:430px;margin:auto;background:#fff;padding:28px;border-radius:18px;box-shadow:0 8px 30px #0001}img{width:220px;height:220px;object-fit:contain;display:block;margin:20px auto}.btn{width:100%;padding:14px;border:0;border-radius:10px;background:#173b20;color:#fff;font-weight:700}.input{width:100%;padding:12px;border:1px solid #ccc;border-radius:8px;box-sizing:border-box;margin:8px 0 14px}</style></head><body><div class="card"><h2>${MERCHANT_NAME}</h2><p>Order #${order.id}</p><h1>₹${safeTotal}</h1><p>Pay using the UPI ID below, then submit your UTR.</p><p><strong>${MERCHANT_UPI_ID || 'UPI is not configured yet'}</strong></p>${MERCHANT_UPI_ID ? '<img src="/images/qr_scanner.jpg" alt="UPI QR">' : ''}<form method="post" action="/api/payment/claim/${order.id}"><input class="input" name="utr" minlength="6" placeholder="Enter UTR after payment" required><button class="btn">Submit Payment Reference</button></form></div></body></html>`);
    }

    return res.type('html').send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Secure Payment | ${MERCHANT_NAME}</title><script src="https://checkout.razorpay.com/v1/checkout.js"></script><style>body{font-family:Arial;background:#f7f3ea;display:grid;place-items:center;min-height:100vh}.card{background:#fff;padding:30px;border-radius:18px;text-align:center;max-width:420px;width:calc(100% - 40px)}button{padding:14px 22px;border:0;border-radius:10px;background:#173b20;color:#fff;font-weight:700}</style></head><body><div class="card"><h2>${MERCHANT_NAME}</h2><p>Order #${order.id}</p><h1>₹${safeTotal}</h1><p>Customer: ${safeName}</p><button id="pay">Pay securely</button><p id="msg"></p></div><script>document.getElementById('pay').onclick=function(){const rzp=new Razorpay({key:${JSON.stringify(keyId)},amount:${Math.round(order.total*100)},currency:'INR',name:${JSON.stringify(MERCHANT_NAME)},description:'Happy Hair Order #${order.id}',order_id:${JSON.stringify(data.gatewayOrderId)},prefill:{name:${JSON.stringify(order.customer_name)},email:${JSON.stringify(order.email)},contact:${JSON.stringify(order.phone)}},handler:async function(resp){document.getElementById('msg').textContent='Verifying payment...';const r=await fetch('/api/payment/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({order_id:${order.id},razorpay_order_id:resp.razorpay_order_id,razorpay_payment_id:resp.razorpay_payment_id,razorpay_signature:resp.razorpay_signature})});const d=await r.json();if(r.ok){location.href='/api/orders/status/'+${order.id}}else{document.getElementById('msg').textContent=d.error||'Payment verification failed';}},modal:{ondismiss:function(){document.getElementById('msg').textContent='Payment window closed.'}}});rzp.open()};</script></body></html>`);
  } catch (error) {
    console.error('[CHECKOUT]', error);
    res.status(500).send('Unable to open checkout');
  }
});

router.post('/create/:orderId', async (req, res) => {
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({ error: 'Online payment gateway is not configured' });
    const Razorpay = require('razorpay');
    const order = await prisma.order.findUnique({ where: { id: Number(req.params.orderId) } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const existing = paymentData(order);
    if (existing.gatewayOrderId) return res.json({ key_id: process.env.RAZORPAY_KEY_ID, gateway_order_id: existing.gatewayOrderId, amount: Math.round(order.total * 100), currency: 'INR' });
    const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    const rp = await razorpay.orders.create({ amount: Math.round(order.total * 100), currency: 'INR', receipt: `HH-${order.id}`, notes: { internal_order_id: String(order.id) } });
    const data = { gateway: 'razorpay', gatewayOrderId: rp.id };
    await prisma.order.update({ where: { id: order.id }, data: { payment_receipt: savePaymentData(data) } });
    res.json({ key_id: process.env.RAZORPAY_KEY_ID, gateway_order_id: rp.id, amount: rp.amount, currency: rp.currency });
  } catch (error) { console.error('[RAZORPAY CREATE]', error); res.status(502).json({ error: 'Unable to create payment order' }); }
});

router.post('/verify', async (req, res) => {
  try {
    const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const order = await prisma.order.findUnique({ where: { id: Number(order_id) } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const stored = paymentData(order);
    if (!stored.gatewayOrderId || stored.gatewayOrderId !== razorpay_order_id) return res.status(400).json({ error: 'Payment order mismatch' });
    if (!process.env.RAZORPAY_KEY_SECRET) return res.status(500).json({ error: 'Payment gateway is not configured' });
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
    if (expected !== razorpay_signature) return res.status(400).json({ error: 'Payment signature verification failed' });
    await prisma.order.update({ where: { id: order.id }, data: { payment_receipt: savePaymentData({ ...stored, paymentId: razorpay_payment_id, verified: true, verifiedAt: new Date().toISOString() }) } });
    const updated = await finalizePaidOrder(order.id);
    res.json({ message: 'Payment verified', order_id: updated.id, status: updated.status, shipping_order_no: updated.order_no || null });
  } catch (error) { console.error('[RAZORPAY VERIFY]', error); res.status(500).json({ error: 'Payment verification failed' }); }
});

router.post('/claim/:orderId', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const id = Number(req.params.orderId);
    const utr = String(req.body.utr || '').trim();
    if (utr.length < 6) return res.status(400).send('Invalid UTR');
    await prisma.order.update({ where: { id }, data: { utr, status: 'PENDING_PAYMENT' } });
    res.redirect(`/api/orders/status/${id}`);
  } catch { res.status(500).send('Unable to submit payment reference'); }
});

router.get('/status/:orderId', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: Number(req.params.orderId) } });
    if (!order) return res.status(404).json({ error: 'Not found' });
    res.json({ status: order.status, order_no: order.order_no, utr: order.utr, customer_name: order.customer_name, address: order.address, city: order.city, state: order.state, pincode: order.pincode, phone: order.phone, total: order.total, pay_mode: order.pay_mode, cart_details: order.cart_details });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/approve/:orderId', authMiddleware, async (req, res) => {
  try {
    const updated = await finalizePaidOrder(Number(req.params.orderId));
    res.json({ message: 'Payment approved', order_id: updated.id, status: updated.status, shipCorrectOrderNo: updated.order_no || null });
  } catch (error) { res.status(400).json({ error: error.message || 'Unable to approve payment' }); }
});

module.exports = router;
