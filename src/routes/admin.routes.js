const express = require('express');
const router = express.Router();
const { 
  getDashboardStats, getAllUsers, toggleUserStatus, adjustUserCredit,updateUserRole,
  getSettings, updateSetting, createCreditPackage, createPromotion, getAllPackagesAdmin, getAllPromotionsAdmin, togglePackageStatus, togglePromotionStatus 
} = require('../controllers/admin.controller');

// Import Auth (nhớ dùng tên middleware verifyToken của bạn nhé)
const verifyToken = require('../middlewares/auth.middleware');
// Import Admin middleware vừa tạo
const isAdmin = require('../middlewares/admin.middleware');

// Áp dụng CẢ 2 middleware: Phải đăng nhập VÀ Phải là Admin
router.use(verifyToken, isAdmin);

// Báo cáo thống kê
router.get('/dashboard', getDashboardStats);
// Quản lý User
router.get('/users', getAllUsers);
router.patch('/users/:userId/status', toggleUserStatus);
router.post('/users/:userId/credits', adjustUserCredit);
router.patch('/users/:userId/role', updateUserRole);

// Routes Cấu hình (Settings)
router.get('/settings', getSettings);
router.put('/settings', updateSetting);

// Routes Quản lý Gói & Khuyến mãi
router.patch('/packages/:id/toggle', togglePackageStatus);
router.get('/packages', getAllPackagesAdmin);
router.post('/packages', createCreditPackage);
router.get('/promotions', getAllPromotionsAdmin);
router.post('/promotions', createPromotion);
router.patch('/promotions/:id/toggle', togglePromotionStatus);
module.exports = router;