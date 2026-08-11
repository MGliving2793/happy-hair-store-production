const { z } = require('zod');
const xss = require('xss-clean');

// Zod schemas for different routes
const schemas = {
  login: z.object({
    body: z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }),
  }),
  createOrder: z.object({
    body: z.object({
      customer_name: z.string().min(1).max(255).optional(),
      full_name: z.string().min(1).max(255).optional(),
      name: z.string().min(1).max(255).optional(),
      email: z.string().email().optional().or(z.literal('')),
      customer_email: z.string().email().optional().or(z.literal('')),
      address: z.string().min(1).optional(),
      customer_address1: z.string().min(1).optional(),
      address_line1: z.string().min(1).optional(),
      address_line2: z.string().optional(),
      state: z.string().min(1).optional(),
      customer_address_state: z.string().min(1).optional(),
      city: z.string().min(1).optional(),
      customer_address_city: z.string().min(1).optional(),
      pincode: z.string().min(6).max(6).optional(),
      customer_address_pincode: z.string().min(6).max(6).optional(),
      phone: z.string().min(10).max(15).optional(),
      customer_contact_number1: z.string().min(10).max(15).optional(),
      mobile: z.string().min(10).max(15).optional(),
      pay_mode: z.enum(['PREPAID', 'COD', 'UPI']).optional(),
      payment_method: z.enum(['PREPAID', 'COD', 'UPI']).optional(),
      utr: z.string().optional(),
      quantity: z.union([z.number(), z.string()]).optional(),
      product_id: z.union([z.number(), z.string()]).optional(),
      cart: z.array(z.object({
        title: z.string(),
        price: z.union([z.number(), z.string()]).optional(),
        quantity: z.union([z.number(), z.string()]),
        SKU: z.string().optional(),
        product_id: z.union([z.number(), z.string()]).optional(),
        pay_mode: z.string().optional(),
      })).optional()
    })
  }),
  createProduct: z.object({
    body: z.object({
      title: z.string().min(1),
      price: z.number().positive(),
      description: z.string().optional(),
      image_url: z.string().optional(),
      stock: z.number().int().nonnegative().optional()
    })
  })
};

const validate = (schema) => async (req, res, next) => {
  try {
    if (schema) {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
    }
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    next(error);
  }
};

module.exports = {
  validate,
  schemas,
  xssClean: xss()
};
