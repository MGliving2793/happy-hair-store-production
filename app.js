const API_BASE = '';

function getAuthHeaders() {
  const t = localStorage.getItem('token');
  if (!t) return {};
  return { 'Authorization': `Bearer ${t}` };
}

async function handleResponse(res) {
  if (res.status === 401) {
    localStorage.removeItem('token');
    document.getElementById('login-overlay').classList.remove('hidden');
    document.getElementById('dashboard-wrapper').classList.add('hidden');
    alert('Session expired. Please login again.');
    throw new Error('Session expired');
  }
  return res;
}

if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const token = localStorage.getItem('token');
    const loginOverlay = document.getElementById('login-overlay');
    const dashboardWrapper = document.getElementById('dashboard-wrapper');
    const logoutBtn = document.getElementById('logout-btn');
}

// List Containers
const productsShowcaseList = document.getElementById('products-showcase-list');
const ordersTableBody = document.getElementById('orders-table-body');
const reviewsTableBody = document.getElementById('reviews-table-body');
const pageHeading = document.getElementById('page-heading');

// Auto-Login check
if (token) {
    showDashboard();
}

// Login Handler
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-submit-btn');

    btn.textContent = 'Authenticating...';
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await res.json();
        if (res.ok && data.token) {
            localStorage.setItem('token', data.token);
            showDashboard();
        } else {
            alert(data.error || 'Invalid credentials');
        }
    } catch (err) {
        console.error(err);
        alert('Login failed to connect to server');
    } finally {
        btn.textContent = 'Sign In to Dashboard';
        btn.disabled = false;
    }
});

// Logout Handler
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    loginOverlay.classList.remove('hidden');
    dashboardWrapper.classList.add('hidden');
});

function showDashboard() {
    loginOverlay.classList.add('hidden');
    dashboardWrapper.classList.remove('hidden');
    loadProducts();
    loadOrders();
    loadReviews();
}

// Tab Navigation
const navLinks = document.querySelectorAll('.sidebar-menu .nav-link');
const tabContents = document.querySelectorAll('.tab-content');

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        
        navLinks.forEach(item => item.classList.remove('active'));
        tabContents.forEach(tab => tab.classList.remove('active'));
        
        link.classList.add('active');
        const tabId = link.getAttribute('data-tab');
        document.getElementById(`tab-${tabId}`).classList.add('active');
        
        if (tabId === 'products') pageHeading.textContent = 'Products Management';
        if (tabId === 'orders') pageHeading.textContent = 'Customer Orders';
        if (tabId === 'reviews') pageHeading.textContent = 'Customer Reviews';
    });
});

// =========================================================
// PRODUCTS MANAGEMENT (ADD & DELETE DIRECTLY TO WEBSITE)
// =========================================================
async function loadProducts() {
    try {
        const res = await fetch(`${API_BASE}/api/products`, {
            headers: getAuthHeaders()
        });
        await handleResponse(res);
        const products = await res.json();

        if (products.length === 0) {
            productsShowcaseList.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No products currently listed on live website.</p>`;
            return;
        }

        productsShowcaseList.innerHTML = products.map(p => {
            const img = p.image_url ? (p.image_url.startsWith('http') || p.image_url.startsWith('/') ? p.image_url : '/' + p.image_url) : '/images/w0ut7ai7_WhatsApp%20Image%202026-06-23%20at%2010.55.35%20AM.jpeg';
            return `
            <div class="prod-card-item">
                <div>
                    <div class="prod-img-box">
                        <img src="${img}" onerror="this.src='https://via.placeholder.com/300x180?text=Product+Image'">
                    </div>
                    <div class="live-badge">
                        <span class="live-dot"></span>
                        <span>Live on Main Website</span>
                    </div>
                    <div class="prod-card-title">${p.title}</div>
                    <div class="prod-card-price">₹${p.price}</div>
                </div>

                <div style="margin-top: 14px;">
                    <button class="btn-danger" style="width: 100%; text-align: center;" onclick="deleteProduct(${p.id})">Delete Product From Website</button>
                </div>
            </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Failed to load products:', err);
    }
}

// Add Product Form
addProductForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('prod-title').value;
    const price = document.getElementById('prod-price').value;
    const image_url = document.getElementById('prod-image').value;
    const stock = document.getElementById('prod-stock').value;
    const btn = document.getElementById('add-prod-btn');

    btn.textContent = 'Publishing to Website...';
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/api/products`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ 
                title, 
                price: parseFloat(price), 
                image_url: image_url || 'images/w0ut7ai7_WhatsApp Image 2026-06-23 at 10.55.35 AM.jpeg',
                stock: parseInt(stock || 100)
            })
        });

        await handleResponse(res);

        if (res.ok) {
            addProductForm.reset();
            loadProducts();
            alert('Product published successfully! It is now live on the main website for customers to buy.');
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to add product');
        }
    } catch (err) {
        console.error(err);
        alert('Error publishing product');
    } finally {
        btn.textContent = '✦ Publish Product To Live Website';
        btn.disabled = false;
    }
});

// Delete Product
window.deleteProduct = async function(id) {
    if (!confirm('Are you sure you want to delete this product from the main website?')) return;

    try {
        const res = await fetch(`${API_BASE}/api/products/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        await handleResponse(res);

        if (res.ok) {
            loadProducts();
            alert('Product deleted successfully from the website!');
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to delete product');
        }
    } catch (err) {
        console.error(err);
        alert('Network error deleting product');
    }
};

// =========================================================
// ORDERS MANAGEMENT
// =========================================================
async function loadOrders() {
    try {
        const res = await fetch(`${API_BASE}/api/orders`, {
            headers: getAuthHeaders()
        });
        await handleResponse(res);
        const orders = await res.json();

        ordersTableBody.innerHTML = orders.map(o => {
            const date = new Date(o.createdAt).toLocaleDateString();
            const isApproved = (o.status === 'Processing' || o.status === 'PAID' || o.status === 'Shipped' || o.status === 'Delivered');

            const statusOptions = ['Pending', 'PAID', 'Processing', 'Shipped', 'Delivered', 'Cancelled']
                .map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`).join('');

            return `
            <tr>
                <td><strong>#${o.id}</strong></td>
                <td>
                    <div style="font-weight: 600;">${o.customer_name}</div>
                    <div style="font-size: 12px; color: var(--text-muted);">${o.phone}</div>
                </td>
                <td>${o.city || 'N/A'}, ${o.state || ''}</td>
                <td>${date}</td>
                <td>
                    <select class="form-input" style="padding: 6px; width: 100%; min-width: 110px; font-size: 13px; background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-gold);" onchange="updateOrderStatus(${o.id}, this.value)">
                        ${statusOptions}
                    </select>
                </td>
                <td>${o.utr || '-'}</td>
                <td>
                    <span style="color: var(--gold-primary); font-weight: 600;">${o.order_no || 'Pending Dispatch'}</span>
                </td>
                <td><strong>₹${o.total}</strong></td>
                <td>
                    ${!isApproved ? 
                        `<button class="btn-gold" style="padding: 6px 12px; font-size: 12px; margin-right: 6px;" onclick="approvePayment(${o.id}, this)">Approve Payment</button>` : 
                        `<span style="color: var(--success); font-weight: 600; font-size: 12px; margin-right: 6px;">✓ Dispatched</span>`
                    }
                    <button class="btn-danger" onclick="deleteOrder(${o.id})">Delete</button>
                </td>
            </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Failed to load orders:', err);
    }
}

window.updateOrderStatus = async function(id, status) {
    try {
        const res = await fetch(`${API_BASE}/api/orders/${id}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ status })
        });
        await handleResponse(res);
        loadOrders();
    } catch (err) {
        console.error('Failed to update status:', err);
    }
};

window.approvePayment = async function(orderId, btnElement) {
    if (btnElement) {
        btnElement.textContent = 'Approving...';
        btnElement.disabled = true;
    }
    try {
        const res = await fetch(`${API_BASE}/api/payment/approve/${orderId}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            }
        });
        await handleResponse(res);
        const data = await res.json();
        if (res.ok) {
            alert(`Payment Approved!\nShiprocket Order #: ${data.shipCorrectOrderNo || 'Dispatched'}`);
            loadOrders();
        } else {
            alert(data.error || 'Failed to approve payment');
            if (btnElement) {
                btnElement.textContent = 'Approve Payment';
                btnElement.disabled = false;
            }
        }
    } catch (err) {
        console.error(err);
        alert('Network error approving payment');
        if (btnElement) {
            btnElement.textContent = 'Approve Payment';
            btnElement.disabled = false;
        }
    }
};

window.deleteOrder = async function(id) {
    if (!confirm('Delete this customer order?')) return;
    try {
        const res = await fetch(`${API_BASE}/api/orders/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        await handleResponse(res);
        loadOrders();
    } catch (err) {
        console.error(err);
    }
};

// =========================================================
// REVIEWS MANAGEMENT
// =========================================================
async function loadReviews() {
    try {
        const res = await fetch(`${API_BASE}/api/reviews`, {
            headers: getAuthHeaders()
        });
        await handleResponse(res);
        const reviews = await res.json();

        reviewsTableBody.innerHTML = reviews.map(r => {
            const date = new Date(r.createdAt).toLocaleDateString();
            let stars = '';
            for(let i=0; i<5; i++) {
                stars += `<span style="color: ${i < r.rating ? '#f59e0b' : '#555'}">★</span>`;
            }

            return `
            <tr>
                <td><strong>${r.customer_name}</strong></td>
                <td>${stars}</td>
                <td style="max-width: 250px; white-space: normal;">"${r.comment}"</td>
                <td>${date}</td>
                <td>
                    <span class="${r.is_published ? 'status-badge-approved' : 'status-badge-pending'}">
                        ${r.is_published ? 'Published' : 'Hidden'}
                    </span>
                </td>
                <td>
                    <button class="btn-gold" style="padding: 6px 12px; font-size: 12px; margin-right: 6px;" onclick="toggleReview(${r.id}, ${!r.is_published})">
                        ${r.is_published ? 'Hide' : 'Publish'}
                    </button>
                    <button class="btn-danger" onclick="deleteReview(${r.id})">Delete</button>
                </td>
            </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Failed to load reviews:', err);
    }
}

window.toggleReview = async function(id, isPublished) {
    try {
        const res = await fetch(`${API_BASE}/api/reviews/${id}/publish`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ is_published: isPublished })
        });
        await handleResponse(res);
        loadReviews();
    } catch (err) {
        console.error(err);
    }
};

window.deleteReview = async function(id) {
    if (!confirm('Delete review?')) return;
    try {
        const res = await fetch(`${API_BASE}/api/reviews/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        await handleResponse(res);
        loadReviews();
    } catch (err) {
        console.error(err);
    }
};
