const express = require('express');
const router = express.Router();
const prisma = require('../db');
const authMiddleware = require('../middlewares/auth.middleware');
const { dispatchToShipCorrect } = require('../controllers/order.controller');

// Change these to your actual details
const MERCHANT_UPI_ID = process.env.MERCHANT_UPI_ID || 'murthyjio7@ibl';
const MERCHANT_NAME = process.env.MERCHANT_NAME || 'Happy Hair';

// Simple HTML sanitizer
function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>"'&]/g, (char) => {
    const map = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' };
    return map[char] || char;
  });
}

/**
 * 0. UPI Config - Returns the merchant UPI configuration
 * GET /api/payment/upi-config
 */
router.get('/upi-config', (req, res) => {
  res.json({
    active: true,
    upi_id: MERCHANT_UPI_ID,
    merchant_name: MERCHANT_NAME,
    message: "UPI is currently available"
  });
});

/**
 * 1. Checkout Page - Renders the payment gateway UI
 * GET /api/payment/checkout/:orderId
 */
router.get('/checkout/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) }
    });

    if (!order) {
      return res.status(404).send('Order not found');
    }

    // Auto-update to Pending Verification if not already
    if (order.status === 'PENDING') {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'Pending Verification' }
      });
    }

    const safeCustomerName = sanitize(order.customer_name);
    const safeAddress = sanitize(order.address);
    const safeCity = sanitize(order.city);
    const safePincode = sanitize(order.pincode);
    const safeOrderNo = sanitize(order.order_no);

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>Secure Checkout | ${MERCHANT_NAME}</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,600;1,600&display=swap" rel="stylesheet">
        <style>
          :root {
            --primary: #c99339;
            --primary-glow: rgba(201, 147, 57, 0.3);
            --bg: #0a0a0a;
            --surface: #111111;
            --text: #f5f5f5;
            --text-light: #a3a3a3;
            --border: #333333;
            --success: #10b981;
          }
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Outfit', sans-serif; }
          body { background-color: var(--bg); color: var(--text); display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
          
          .gateway {
            background: rgba(17, 17, 17, 0.8);
            backdrop-filter: blur(20px);
            width: 100%;
            max-width: 440px;
            border-radius: 24px;
            border: 1px solid var(--border);
            box-shadow: 0 20px 40px rgba(0,0,0,0.6);
            overflow: hidden;
            position: relative;
          }
          
          .gateway::before {
            content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 4px;
            background: linear-gradient(90deg, transparent, var(--primary), transparent);
          }
          
          .gw-header {
            padding: 32px 24px 24px;
            text-align: center;
            border-bottom: 1px solid rgba(255,255,255,0.05);
          }
          .gw-brand { font-family: 'Playfair Display', serif; font-size: 20px; color: var(--primary); margin-bottom: 16px; letter-spacing: 1px; }
          .gw-amount-row { display: flex; justify-content: center; align-items: baseline; gap: 12px; margin-bottom: 12px; }
          .gw-amount { font-size: 42px; font-weight: 300; font-family: 'Playfair Display', serif; }
          .gw-order-id { font-size: 14px; color: var(--text-light); text-transform: uppercase; letter-spacing: 1px; }
          .gw-lock { font-size: 12px; color: var(--success); display: flex; align-items: center; justify-content: center; gap: 6px; letter-spacing: 0.5px; text-transform: uppercase; margin-top: 16px; }
          
          .gw-body { padding: 32px 24px; text-align: center; }
          
          .step { display: none; }
          .step.active { display: block; animation: fadeIn 0.5s ease; }
          
          .step-label { font-size: 14px; font-weight: 500; color: var(--text-light); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 24px; }
          
          /* QR Code Scanner */
          .qr-box {
            background: #ffffff;
            border-radius: 20px;
            padding: 32px 24px;
            margin-bottom: 24px;
            position: relative;
            box-shadow: 0 0 30px rgba(255,255,255,0.05);
          }
          .qr-box img {
            width: 220px;
            height: 220px;
            object-fit: cover;
            border-radius: 12px;
            margin-bottom: 24px;
          }
          .qr-upi { font-size: 18px; font-weight: 600; color: #111; margin-bottom: 8px; letter-spacing: 0.5px; }
          .qr-hint { font-size: 14px; color: #666; font-weight: 500; }
          
          /* Scanning Animation */
          .scanning-status {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: rgba(201, 147, 57, 0.05);
            border: 1px solid rgba(201, 147, 57, 0.2);
            border-radius: 16px;
            margin-top: 24px;
          }
          .radar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: 2px solid var(--primary);
            position: relative;
            margin-bottom: 16px;
          }
          .radar::after {
            content: '';
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 12px; height: 12px;
            background: var(--primary);
            border-radius: 50%;
            animation: pulse 1.5s infinite ease-out;
            box-shadow: 0 0 10px var(--primary);
          }
          .scan-text { font-size: 14px; font-weight: 500; color: var(--primary); letter-spacing: 0.5px; }
          
          /* Success Box */
          .success-box { text-align: center; padding: 20px 0; }
          .success-icon { font-size: 72px; margin-bottom: 24px; animation: popIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
          .success-title { font-size: 28px; font-family: 'Playfair Display', serif; color: var(--success); margin-bottom: 16px; }
          .success-sub { font-size: 16px; color: var(--text-light); margin-bottom: 40px; line-height: 1.6; }
          
          .track-btn {
            display: block; width: 100%; padding: 18px; 
            background: linear-gradient(135deg, #c99339 0%, #a67323 100%); 
            color: #fff; border: none; border-radius: 12px; 
            font-size: 16px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;
            text-decoration: none; transition: all 0.3s ease;
            box-shadow: 0 10px 20px var(--primary-glow);
          }
          .track-btn:hover { transform: translateY(-2px); box-shadow: 0 15px 25px var(--primary-glow); }
          
          .gw-footer { padding: 24px; text-align: center; font-size: 12px; color: var(--border); border-top: 1px solid rgba(255,255,255,0.05); }
          
          @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes pulse { 0% { width: 12px; height: 12px; opacity: 1; } 100% { width: 50px; height: 50px; opacity: 0; } }
          @keyframes popIn { 0% { opacity: 0; transform: scale(0.5); } 100% { opacity: 1; transform: scale(1); } }
        </style>
      </head>
      <body>
        <div class="gateway">
          <!-- HEADER -->
          <div class="gw-header">
            <div class="gw-brand">Happy Hair — Couture Checkout</div>
            <div class="gw-amount-row">
              <span class="gw-amount">₹${order.total}</span>
              <span class="gw-order-id">Order #${order.id}</span>
            </div>
            <div class="gw-lock">🔒 Bank-Grade Encryption</div>
          </div>

          <div class="gw-body">
            <!-- ===== STEP 1: Scanner ===== -->
            <div class="step active" id="step-qr">
              <div class="step-label">Complete Payment</div>
              
              <div class="qr-box">
                <!-- IMPORTANT: Add a leading slash so it loads from domain root -->
                <img src="/qr_scanner.jpg" alt="UPI QR Code" onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg'" />
                <div class="qr-upi">${MERCHANT_UPI_ID}</div>
                <div class="qr-hint">Scan with PhonePe, GPay, or Paytm</div>
              </div>
              
              <div class="scanning-status">
                <div class="radar"></div>
                <div class="scan-text">Awaiting transfer confirmation...</div>
              </div>
            </div>

            <!-- ===== STEP 2: Success ===== -->
            <div class="step" id="step-success">
              <div class="success-box">
                <div class="success-icon">🎉</div>
                <div class="success-title" style="color: var(--primary);">Payment Approved!</div>
                <div class="success-sub">Your payment has been received and approved by management. Your order has been dispatched to Shiprocket / ShipCorrect for delivery.</div>
                
                <div id="order-details-card" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 16px; padding: 20px; text-align: left; margin-bottom: 24px;">
                  <p style="margin-bottom: 8px;"><strong>Order ID:</strong> <span id="detail-order-id">#${order.id}</span></p>
                  <p style="margin-bottom: 8px;"><strong>Shiprocket / Shipping Order #:</strong> <span id="detail-shipno" style="color: var(--primary); font-weight: 700;">${safeOrderNo || 'Generating...'}</span></p>
                  <p style="margin-bottom: 8px;"><strong>Customer:</strong> <span id="detail-customer">${safeCustomerName}</span></p>
                  <p style="margin-bottom: 8px;"><strong>Delivery Address:</strong> <span id="detail-address">${safeAddress} ${safeCity ? ', ' + safeCity : ''} ${safePincode ? ' - ' + safePincode : ''}</span></p>
                  <p style="margin-bottom: 0;"><strong>Total Paid:</strong> <span id="detail-total" style="color: var(--success); font-weight: 700;">₹${order.total}</span></p>
                </div>

                <a href="/api/orders/status/${order.id}" class="track-btn">Track Order Progress</a>
              </div>
            </div>
          </div>

          <div class="gw-footer">
            <p>100% SECURE TRANSACTIONS • ${MERCHANT_NAME}</p>
          </div>
        </div>

        <script>
          const ORDER_ID = ${order.id};
          let pollTimer = null;

          function goToStep(stepId) {
            document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
            document.getElementById(stepId).classList.add('active');
          }

          // Start polling backend immediately
          function startPolling() {
            pollTimer = setInterval(async () => {
              try {
                const res = await fetch('/api/payment/status/' + ORDER_ID);
                const data = await res.json();
                
                // If status is "Processing", "PAID", or anything other than Pending
                if (data.status && data.status !== 'Pending Verification' && data.status !== 'PENDING') {
                  clearInterval(pollTimer);
                  
                  // Helper function to escape HTML before setting textContent (or rely on textContent which handles it naturally)
                  if (data.order_no) document.getElementById('detail-shipno').textContent = data.order_no;
                  if (data.customer_name) document.getElementById('detail-customer').textContent = data.customer_name;
                  
                  let fullAddress = data.address || '';
                  if (data.city) fullAddress += ', ' + data.city;
                  if (data.pincode) fullAddress += ' - ' + data.pincode;
                  if (fullAddress) document.getElementById('detail-address').textContent = fullAddress;
                  
                  if (data.total) document.getElementById('detail-total').textContent = '₹' + data.total;
                  goToStep('step-success');
                }
              } catch (e) {
                // silently retry
              }
            }, 3000);
          }

          // Start checking on load
          window.onload = startPolling;
        </script>
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).send('Error loading checkout page');
  }
});

/**
 * 2. Get Payment Status (Polled by frontend)
 * GET /api/payment/status/:orderId
 */
router.get('/status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) }
    });

    if (!order) return res.status(404).json({ error: 'Not found' });
    
    res.json({ 
      status: order.status, 
      order_no: order.order_no, 
      utr: order.utr,
      customer_name: order.customer_name,
      address: order.address,
      city: order.city,
      state: order.state,
      pincode: order.pincode,
      phone: order.phone,
      total: order.total,
      pay_mode: order.pay_mode,
      cart_details: order.cart_details
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * 3. Approve Payment (MERCHANT ENDPOINT)
 * POST /api/payment/approve/:orderId
 * Call this after you manually verify the payment in your bank.
 */
router.post('/approve/:orderId', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) }
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status === 'Processing' || order.status === 'PAID' || order.status === 'Shipped') {
      return res.status(400).json({ error: 'Order is already approved' });
    }

    // 1. Dispatch to ShipCorrect / Shiprocket
    let cart = [];
    try { cart = JSON.parse(order.cart_details); } catch(e) {}
    
    const shipCorrectOrderNo = await dispatchToShipCorrect(order, cart);

    // 2. Update status to Processing
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { 
        status: 'Processing',
        order_no: shipCorrectOrderNo ? shipCorrectOrderNo.toString() : order.order_no
      }
    });

    res.json({ 
      message: 'Payment verified! Order dispatched to ShipCorrect / Shiprocket.',
      shipCorrectOrderNo,
      order_id: order.id,
      status: updatedOrder.status
    });
  } catch (error) {
    console.error('Approve error:', error);
    res.status(500).json({ error: 'Failed to approve payment' });
  }
});

module.exports = router;
