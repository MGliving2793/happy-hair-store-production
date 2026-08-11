module.exports = {
  authMiddleware: require('./auth.middleware'),
  ...require('./validate.middleware')
};
