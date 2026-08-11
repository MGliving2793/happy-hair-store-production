const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../db');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    if (!process.env.JWT_SECRET) return res.status(500).json({ error: 'Server configuration error' });
    const admin = await prisma.admin.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!admin || !(await bcrypt.compare(password, admin.password))) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ adminId: admin.id, email: admin.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: 'Login successful', token });
  } catch (error) {
    console.error('[AUTH]', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
module.exports = { login };
