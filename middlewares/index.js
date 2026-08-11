const authMiddleware = require('./auth.middleware');
const { validate, schemas, xssClean } = require('./validate.middleware');
module.exports = { authMiddleware, validate, schemas, xssClean };
