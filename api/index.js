const express = require('express');
const router = express.Router();
router.use('/auth', require('./auth.routes'));
router.use('/products', require('./product.routes'));
router.use('/orders', require('./order.routes'));
router.use('/payment', require('./payment.routes'));
router.use('/reviews', require('./review.routes'));
module.exports = router;
