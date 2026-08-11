const axios = require('axios');
const prisma = require('../db');

function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>"'&]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c]));
}

function getItems(cart) {
  if (!Array.isArray(cart) || cart.length === 0) throw new Error('Cart is empty');
  return cart.map(item => {
    const productId = Number(item.product_id);
    const quantity = Number(item.quantity);
    if (!Number.isInteger(productId) || productId <= 0) throw new Error('Invalid product');
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 20) throw new Error('Invalid quantity');
    return { productId, quantity };
  });
}

async function getPricedCart(cart) {
  const requested = getItems(cart);
  const ids = [...new Set(requested.map(x => x.productId))];
  const products = await prisma.product.findMany({ where: { id: { in: ids } } });
  const byId = new Map(products.map(p => [p.id, p]));
  const priced = [];
  for (const item of requested) {
    const product = byId.get(item.productId);
    if (!product) throw new Error(`Product ${item.productId} not found`);
    if (product.stock < item.quantity) throw new Error(`Not enough stock for ${product.title}`);
    priced.push({
      product_id: product.id,
      title: product.title,
      price: product.price,
      quantity: item.quantity,
      SKU: `PROD-${product.id}`
    });
  }
  const total = priced.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return { priced, total };
}

async function decrementStock(tx, cart) {
  for (const item of cart) {
    const result = await tx.product.updateMany({
      where: { id: item.product_id, stock: { gte: item.quantity } },
      data: { stock: { decrement: item.quantity } }
    });
    if (result.count !== 1) throw new Error(`Not enough stock for product ${item.product_id}`);
  }
}

async function dispatchToShipCorrect(order, cart) {
  const apiKey = process.env.SHIPCORRECT_API_KEY;
  const baseUrl = process.env.SHIPCORRECT_BASE_URL;
  if (!apiKey || !baseUrl) {
    console.warn('[SHIPPING] Shipping credentials are not configured. Order remains ready for fulfillment.');
    return null;
  }

  const payload = {
    api_key: apiKey,
    customer_name: order.customer_name,
    customer_email: order.email || '',
    customer_address1: order.address,
    customer_address2: '',
    customer_address_landmark: '',
    customer_address_state: order.state,
    customer_address_city: order.city,
    customer_address_pincode: order.pincode,
    customer_contact_number1: order.phone,
    customer_contact_number2: '',
    product_id: String(cart[0]?.product_id || 1),
    product_name: cart.map(x => x.title).join(', ').slice(0, 100),
    sku: cart[0]?.SKU || 'SKU-HAPPY-HAIR',
    mrp: String(order.total),
    product_size: '10x10',
    product_weight: '0.5',
    product_color: 'Standard',
    pay_mode: order.pay_mode === 'COD' ? 'COD' : 'PREPAID',
    quantity: String(cart.reduce((sum, x) => sum + x.quantity, 0)),
    total_amount: String(order.total),
    client_order_no: String(order.id),
    length: 10, breadth: 10, height: 5,
    pickup_id: process.env.SHIPCORRECT_PICKUP_ID || 'WH-001'
  };

  const url = baseUrl.replace(/\/$/, '') + '/createForwardOrder.php';
  try {
    const response = await axios.post(url, payload, { timeout: 10000, headers: { 'Content-Type': 'application/json' } });
    const orderNo = response.data?.order_no;
    if (!orderNo) throw new Error(response.data?.message || 'Shipping provider did not return an order number');
    return String(orderNo);
  } catch (error) {
    console.error('[SHIPPING]', error.response?.data || error.message);
    return null;
  }
}

async function finalizePaidOrder(orderId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error('Order not found');
  if (['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status)) return order;

  let cart;
  try { cart = JSON.parse(order.cart_details || '[]'); } catch { cart = []; }
  if (!cart.length) throw new Error('Order cart is invalid');

  await prisma.$transaction(async tx => {
    await decrementStock(tx, cart);
    await tx.order.update({ where: { id: orderId }, data: { status: 'PAID' } });
  });

  const refreshed = await prisma.order.findUnique({ where: { id: orderId } });
  const shippingNo = await dispatchToShipCorrect(refreshed, cart);
  if (shippingNo) {
    return prisma.order.update({ where: { id: orderId }, data: { status: 'PROCESSING', order_no: shippingNo } });
  }
  return prisma.order.findUnique({ where: { id: orderId } });
}

const createOrder = async (req, res) => {
  try {
    const { name, full_name, customer_name, email, customer_email, address, customer_address1, address_line1, address_line2, state, city, pincode, phone, customer_contact_number1, mobile, pay_mode, payment_method, cart } = req.body;
    const finalName = sanitize(customer_name || full_name || name || 'Valued Customer');
    const finalAddress = sanitize(customer_address1 || address || [address_line1, address_line2].filter(Boolean).join(', '));
    const finalPhone = String(customer_contact_number1 || phone || mobile || '').trim();
    const finalEmail = sanitize(customer_email || email || '');
    const finalState = sanitize(state || '');
    const finalCity = sanitize(city || '');
    const finalPincode = String(pincode || '').trim();
    const mode = String(pay_mode || payment_method || 'PREPAID').toUpperCase();

    if (!finalName || !finalAddress || !/^\d{10}$/.test(finalPhone) || !/^\d{6}$/.test(finalPincode)) {
      return res.status(400).json({ error: 'Name, full address, 10-digit phone and 6-digit pincode are required' });
    }
    if (!['PREPAID', 'UPI', 'COD'].includes(mode)) return res.status(400).json({ error: 'Invalid payment method' });

    const { priced, total } = await getPricedCart(cart);
    const order = await prisma.order.create({
      data: {
        customer_name: finalName,
        email: finalEmail,
        phone: finalPhone,
        address: finalAddress,
        city: finalCity,
        state: finalState,
        pincode: finalPincode,
        pay_mode: mode === 'UPI' ? 'UPI' : mode,
        total,
        status: mode === 'COD' ? 'PENDING' : 'PENDING_PAYMENT',
        cart_details: JSON.stringify(priced)
      }
    });

    if (mode === 'COD') {
      await prisma.$transaction(async tx => {
        await decrementStock(tx, priced);
        await tx.order.update({ where: { id: order.id }, data: { status: 'PROCESSING' } });
      });
      const shippingNo = await dispatchToShipCorrect(order, priced);
      const updated = shippingNo ? await prisma.order.update({ where: { id: order.id }, data: { order_no: shippingNo } }) : await prisma.order.findUnique({ where: { id: order.id } });
      return res.status(201).json({ message: 'COD order created', order_id: updated.id, shipCorrectOrderNo: updated.order_no });
    }

    res.status(201).json({ message: 'Order created. Continue to payment.', order_id: order.id, checkout_url: `/api/payment/checkout/${order.id}` });
  } catch (error) {
    console.error('[ORDER CREATE]', error);
    res.status(400).json({ error: error.message || 'Unable to create order' });
  }
};

const approveOrder = async (req, res) => {
  try {
    const orderId = Number(req.body.order_id);
    if (!Number.isInteger(orderId)) return res.status(400).json({ error: 'order_id is required' });
    const updated = await finalizePaidOrder(orderId);
    res.json({ message: 'Payment approved', order_id: updated.id, status: updated.status, shipCorrectOrderNo: updated.order_no || null });
  } catch (error) {
    console.error('[ORDER APPROVE]', error);
    res.status(400).json({ error: error.message || 'Unable to approve order' });
  }
};

const claimUpi = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const utr = sanitize(String(req.body.upi_utr || '').trim());
    if (!utr || utr.length < 6) return res.status(400).json({ error: 'Valid UPI UTR is required' });
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const updated = await prisma.order.update({ where: { id }, data: { utr, status: 'PENDING_PAYMENT' } });
    res.json({ message: 'UTR submitted. Payment will be verified by the merchant.', order_id: updated.id, status: updated.status });
  } catch (error) {
    console.error('[UPI CLAIM]', error);
    res.status(500).json({ error: 'Unable to submit UTR' });
  }
};

const trackOrder = async (req, res) => {
  try {
    const { order_no, awb } = req.body;
    if (!order_no && !awb) return res.status(400).json({ error: 'order_no or awb is required' });
    if (!process.env.SHIPCORRECT_API_KEY || !process.env.SHIPCORRECT_BASE_URL) return res.status(503).json({ error: 'Shipping integration is not configured' });
    const response = await axios.post(process.env.SHIPCORRECT_BASE_URL.replace(/\/$/, '') + '/trackOrder.php', { api_key: process.env.SHIPCORRECT_API_KEY, order_no: order_no || awb }, { timeout: 10000 });
    res.json({ tracking_status: response.data?.tracking_status || 'Unknown', scan_stages: response.data?.scan_stages || [] });
  } catch (error) {
    console.error('[TRACK]', error.response?.data || error.message);
    res.status(502).json({ error: 'Unable to fetch tracking information' });
  }
};

const renderTrackingPage = async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: Number(req.params.orderId) } });
  if (!order) return res.status(404).send('Order not found');
  res.type('html').send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Track Order</title><style>body{font-family:Arial,sans-serif;background:#fdfbf7;padding:30px;color:#263b28}.card{max-width:620px;margin:auto;background:#fff;padding:28px;border-radius:18px;border:1px solid #ddd}h1{margin-top:0}.status{font-weight:700}</style></head><body><div class="card"><h1>Happy Hair Order #${order.id}</h1><p>Customer: ${sanitize(order.customer_name)}</p><p>Total: ₹${order.total}</p><p class="status">Status: ${sanitize(order.status)}</p><p>Shipping reference: ${sanitize(order.order_no || 'Not assigned yet')}</p></div></body></html>`);
};

const getAllOrders = async (req, res) => {
  try { res.json(await prisma.order.findMany({ orderBy: { createdAt: 'desc' } })); }
  catch (error) { console.error('[ORDERS]', error); res.status(500).json({ error: 'Unable to load orders' }); }
};

const deleteOrder = async (req, res) => {
  try { await prisma.order.delete({ where: { id: Number(req.params.id) } }); res.json({ message: 'Order deleted successfully' }); }
  catch (error) { res.status(error.code === 'P2025' ? 404 : 500).json({ error: error.code === 'P2025' ? 'Order not found' : 'Unable to delete order' }); }
};

const updateOrderStatus = async (req, res) => {
  const valid = ['PENDING','PENDING_PAYMENT','PAID','PROCESSING','SHIPPED','DELIVERED','CANCELLED','FAILED'];
  if (!valid.includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
  try { const order = await prisma.order.update({ where: { id: Number(req.params.id) }, data: { status: req.body.status } }); res.json({ message: 'Order status updated', order }); }
  catch (error) { res.status(error.code === 'P2025' ? 404 : 500).json({ error: 'Unable to update order' }); }
};

module.exports = { createOrder, approveOrder, trackOrder, claimUpi, dispatchToShipCorrect, renderTrackingPage, getAllOrders, deleteOrder, updateOrderStatus, finalizePaidOrder };
