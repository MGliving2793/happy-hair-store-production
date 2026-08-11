// Production fallback: the original bundle was empty in the supplied project.
// product-sync.js renders the live product/checkout UI into this container.
document.addEventListener('DOMContentLoaded', function () {
  var root = document.getElementById('root');
  if (root && !root.childElementCount) {
    root.innerHTML = '<main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:Arial,sans-serif;background:#0f1c10;color:#fff"><div style="max-width:700px;width:100%;text-align:center"><h1 style="font-size:42px;margin:0 0 12px">Happy Hair</h1><p style="opacity:.8">Nourish Your Hair From Within</p><div id="dynamic-store-container"></div></div></main>';
  }
});
