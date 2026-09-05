const express = require('express');
const router = express.Router();
const { 
  getProfile, 
  updateProfile, 
  getCreditHistory, 
  getVideoHistory 
} = require('../controllers/user.controller');

// Import middleware xác thực token (nếu file auth.middleware.js của bạn có tên khác thì sửa lại đường dẫn)
const verifyToken = require('../middlewares/auth.middleware');

// Phải có verifyToken để đảm bảo chỉ ai đăng nhập mới xem được
router.get('/me', verifyToken, getProfile);
router.put('/me', verifyToken, updateProfile);
router.get('/me/credits', verifyToken, getCreditHistory);
router.get('/me/videos', verifyToken, getVideoHistory);

module.exports = router;