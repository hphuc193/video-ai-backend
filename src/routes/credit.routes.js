const express = require('express');
const router = express.Router();
const { 
  getPackages, 
  buyPackage, 
  getActivePromotions, 
  applyPromotion 
} = require('../controllers/credit.controller');

// Import middleware xác thực y như bên user.routes.js
const verifyToken = require('../middlewares/auth.middleware');

// Routes Gói Credit & Thanh toán
router.get('/packages', verifyToken, getPackages);
router.post('/buy', verifyToken, buyPackage);

// Routes Khuyến mãi
router.get('/promotions', verifyToken, getActivePromotions);
router.post('/promotions/apply', verifyToken, applyPromotion);

module.exports = router;