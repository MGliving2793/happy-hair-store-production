const prisma = require('../db');

function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>"'&]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c]));
}

const getAllProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(products);
  } catch (error) {
    console.error('[PRODUCTS]', error);
    res.status(500).json({ error: 'Unable to load products' });
  }
};

const getProductById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid product id' });
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    console.error('[PRODUCT]', error);
    res.status(500).json({ error: 'Unable to load product' });
  }
};

const createProduct = async (req, res) => {
  try {
    const { title, price, description, image_url, stock } = req.body;
    const parsedPrice = Number(price);
    const parsedStock = stock === undefined ? 0 : Number(stock);
    if (!title?.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0 || !Number.isInteger(parsedStock) || parsedStock < 0) {
      return res.status(400).json({ error: 'Valid title, price and stock are required' });
    }
    const product = await prisma.product.create({
      data: {
        title: sanitize(title.trim()),
        description: description ? sanitize(description) : '',
        price: parsedPrice,
        image_url: image_url ? sanitize(image_url) : null,
        stock: parsedStock
      }
    });
    res.status(201).json(product);
  } catch (error) {
    console.error('[PRODUCT CREATE]', error);
    res.status(500).json({ error: 'Unable to create product' });
  }
};

const updateProduct = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = {};
    if (req.body.title !== undefined) data.title = sanitize(String(req.body.title).trim());
    if (req.body.description !== undefined) data.description = sanitize(String(req.body.description));
    if (req.body.image_url !== undefined) data.image_url = sanitize(String(req.body.image_url));
    if (req.body.price !== undefined) {
      const price = Number(req.body.price);
      if (!Number.isFinite(price) || price <= 0) return res.status(400).json({ error: 'Price must be greater than 0' });
      data.price = price;
    }
    if (req.body.stock !== undefined) {
      const stock = Number(req.body.stock);
      if (!Number.isInteger(stock) || stock < 0) return res.status(400).json({ error: 'Stock must be a non-negative integer' });
      data.stock = stock;
    }
    const product = await prisma.product.update({ where: { id }, data });
    res.json(product);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Product not found' });
    console.error('[PRODUCT UPDATE]', error);
    res.status(500).json({ error: 'Unable to update product' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Product not found' });
    console.error('[PRODUCT DELETE]', error);
    res.status(500).json({ error: 'Unable to delete product' });
  }
};

module.exports = { getAllProducts, getProductById, createProduct, updateProduct, deleteProduct };
