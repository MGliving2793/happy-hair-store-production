(function() {
  const API_BASE = '';

  // Inject modal styles
  const style = document.createElement('style');
  style.textContent = `
    .dynamic-prod-card {
      background: #152718;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 18px;
      color: #fff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: all 0.3s ease;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    }
    .dynamic-prod-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 30px rgba(201, 147, 57, 0.2);
      border-color: #c99339;
    }
    .dynamic-prod-img {
      width: 100%;
      height: 220px;
      object-fit: cover;
      border-radius: 12px;
      margin-bottom: 14px;
      background: #0d1a0e;
    }
    .dynamic-prod-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: #f5f5f5;
      margin-bottom: 8px;
      line-height: 1.3;
    }
    .dynamic-prod-price {
      font-size: 1.25rem;
      font-weight: 700;
      color: #c99339;
      margin-bottom: 14px;
    }
    .dynamic-buy-btn {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #c99339 0%, #a67323 100%);
      color: #ffffff;
      border: none;
      border-radius: 25px;
      font-weight: 700;
      font-size: 0.95rem;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      transition: all 0.2s ease;
    }
    .dynamic-buy-btn:hover {
      background: linear-gradient(135deg, #dba446 0%, #b8822d 100%);
      box-shadow: 0 4px 15px rgba(201, 147, 57, 0.4);
    }
    
    /* Universal Checkout Modal */
    #dyn-checkout-modal {
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.85);
      backdrop-filter: blur(8px);
      z-index: 999999;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 15px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }
    #dyn-checkout-modal.open {
      opacity: 1;
      pointer-events: auto;
    }
    .dyn-modal-card {
      background: #0f1c10;
      border: 1px solid #c99339;
      border-radius: 20px;
      width: 100%;
      max-width: 450px;
      padding: 24px;
      color: #fff;
      position: relative;
      box-shadow: 0 20px 50px rgba(0,0,0,0.8);
      max-height: 90vh;
      overflow-y: auto;
    }
    .dyn-close-btn {
      position: absolute;
      top: 15px; right: 15px;
      background: none; border: none;
      color: #aaa; font-size: 24px; cursor: pointer;
    }
    .dyn-close-btn:hover { color: #fff; }
    .dyn-form-group { margin-bottom: 12px; }
    .dyn-form-group label { display: block; font-size: 12px; color: #ccc; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .dyn-form-group input, .dyn-form-group select {
      width: 100%; padding: 10px 12px; background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #fff; font-size: 14px; box-sizing: border-box;
    }
    .dyn-form-group input:focus, .dyn-form-group select:focus {
      border-color: #c99339; outline: none;
    }
  `;
  document.head.appendChild(style);

  // Render Modal HTML
  const modalDiv = document.createElement('div');
  modalDiv.id = 'dyn-checkout-modal';
  modalDiv.innerHTML = `
    <div class="dyn-modal-card">
      <button class="dyn-close-btn" onclick="closeDynCheckout()">&times;</button>
      <h3 style="color:#c99339; margin-top:0; font-size: 1.3rem; margin-bottom: 4px;">Complete Your Order</h3>
      <p id="dyn-modal-prod-summary" style="font-size:13px; color:#aaa; margin-bottom: 16px;"></p>
      
      <form id="dyn-checkout-form">
        <input type="hidden" id="dyn-prod-id">
        <input type="hidden" id="dyn-prod-title">
        <input type="hidden" id="dyn-prod-price">
        
        <div class="dyn-form-group">
          <label>Full Name *</label>
          <input type="text" id="dyn-name" required placeholder="John Doe">
        </div>
        <div class="dyn-form-group">
          <label>Mobile Number *</label>
          <input type="tel" id="dyn-phone" required placeholder="9876543210" pattern="[0-9]{10}">
        </div>
        <div class="dyn-form-group">
          <label>Email Address</label>
          <input type="email" id="dyn-email" placeholder="john@example.com">
        </div>
        <div class="dyn-form-group">
          <label>Delivery Address *</label>
          <input type="text" id="dyn-address" required placeholder="House No, Building, Street Area">
        </div>
        <div style="display:flex; gap:10px;">
          <div class="dyn-form-group" style="flex:1;">
            <label>City *</label>
            <input type="text" id="dyn-city" required placeholder="Mumbai">
          </div>
          <div class="dyn-form-group" style="flex:1;">
            <label>Pincode *</label>
            <input type="text" id="dyn-pincode" required placeholder="400001" pattern="[0-9]{6}">
          </div>
        </div>
        <div class="dyn-form-group">
          <label>State *</label>
          <input type="text" id="dyn-state" required placeholder="Maharashtra">
        </div>
        <div class="dyn-form-group">
          <label>Payment Method *</label>
          <select id="dyn-paymode">
            <option value="PREPAID">UPI / Online Payment (Fast Delivery)</option>
            <option value="COD">Cash on Delivery (COD)</option>
          </select>
        </div>
        <button type="submit" id="dyn-submit-btn" class="dynamic-buy-btn" style="margin-top:10px;">Proceed to Payment</button>
      </form>
    </div>
  `;
  document.body.appendChild(modalDiv);

  window.closeDynCheckout = function() {
    document.getElementById('dyn-checkout-modal').classList.remove('open');
  };

  window.openProductCheckout = function(id, title, price, imageUrl) {
    document.getElementById('dyn-prod-id').value = id;
    document.getElementById('dyn-prod-title').value = title;
    document.getElementById('dyn-prod-price').value = price;
    document.getElementById('dyn-modal-prod-summary').textContent = `${title} — ₹${price}`;
    document.getElementById('dyn-checkout-modal').classList.add('open');
  };

  // Form Submit Handler
  document.getElementById('dyn-checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('dyn-submit-btn');
    const origText = btn.textContent;
    btn.textContent = 'Processing Order...';
    btn.disabled = true;

    const prodId = document.getElementById('dyn-prod-id').value;
    const prodTitle = document.getElementById('dyn-prod-title').value;
    const prodPrice = parseFloat(document.getElementById('dyn-prod-price').value);

    const payload = {
      full_name: document.getElementById('dyn-name').value,
      phone: document.getElementById('dyn-phone').value,
      email: document.getElementById('dyn-email').value,
      address: document.getElementById('dyn-address').value,
      city: document.getElementById('dyn-city').value,
      pincode: document.getElementById('dyn-pincode').value,
      state: document.getElementById('dyn-state').value,
      pay_mode: document.getElementById('dyn-paymode').value,
      cart: [{
        product_id: prodId,
        title: prodTitle,
        price: prodPrice,
        quantity: 1,
        SKU: 'PROD-' + prodId
      }]
    };

    try {
      const res = await fetch(`${API_BASE}/api/orders/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        closeDynCheckout();
        if (data.checkout_url) {
          window.location.href = data.checkout_url;
        } else if (data.shipCorrectOrderNo || data.order_id) {
          alert(`Order Placed Successfully!\nOrder ID: #${data.order_id}\nShipping Ref: ${data.shipCorrectOrderNo || 'Generated'}`);
          window.location.reload();
        } else {
          alert('Order placed successfully!');
        }
      } else {
        alert(data.error || 'Failed to place order');
      }
    } catch (err) {
      console.error(err);
      alert('Network error placing order');
    } finally {
      btn.textContent = origText;
      btn.disabled = false;
    }
  });

  // Sync Products from API
  async function syncProductsFromBackend() {
    try {
      const res = await fetch(`${API_BASE}/api/products`);
      if (!res.ok) return;
      const products = await res.json();

      let grid = document.getElementById('dynamic-products-grid');
      if (!grid) {
        // Create container if not already present
        const showcaseSec = document.createElement('section');
        showcaseSec.id = 'dynamic-products-showcase';
        showcaseSec.style.cssText = 'max-width: 1200px; margin: 40px auto; padding: 0 20px;';
        showcaseSec.innerHTML = `
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="font-size: 2rem; color: #1a361d; font-family: sans-serif; margin-bottom: 6px;">Our Products Collection</h2>
            <p style="color: #666; font-size: 0.95rem;">Nourish Your Hair & Scalp With 100% Natural Formulations</p>
          </div>
          <div id="dynamic-products-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px;"></div>
        `;
        
        const target = document.getElementById('dynamic-store-container') || document.body;
        target.appendChild(showcaseSec);
        grid = document.getElementById('dynamic-products-grid');
      }

      if (!grid) return;

      if (products.length === 0) {
        grid.innerHTML = `<p style="text-align:center; color:#888; grid-column: 1/-1;">No products currently available.</p>`;
        return;
      }

      grid.innerHTML = products.map(p => {
        const img = p.image_url ? (p.image_url.startsWith('http') || p.image_url.startsWith('/') ? p.image_url : '/' + p.image_url) : '/images/w0ut7ai7_WhatsApp%20Image%202026-06-23%20at%2010.55.35%20AM.jpeg';
        return `
          <div class="dynamic-prod-card" data-product-id="${p.id}">
            <img src="${img}" class="dynamic-prod-img" onerror="this.src='https://via.placeholder.com/300x220?text=Happy+Hair'">
            <div class="dynamic-prod-title">${p.title}</div>
            <div class="dynamic-prod-price">₹${p.price}</div>
            <button class="dynamic-buy-btn" onclick="openProductCheckout(${p.id}, '${p.title.replace(/'/g, "\\'")}', ${p.price}, '${img}')">Buy Now</button>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.warn('Dynamic product sync notice:', err.message);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncProductsFromBackend);
  } else {
    syncProductsFromBackend();
  }
})();
