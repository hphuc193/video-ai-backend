const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project.controller');
const verifyToken = require('../middlewares/auth.middleware');

// Route Webhook (KHÔNG dùng verifyToken để FastAPI có thể truy cập được)
router.post('/webhook', projectController.webhookUpdateVideo);

// Route tạo dự án mới
router.post('/', verifyToken, projectController.createProject);

// Route lấy danh sách tất cả dự án (Màn hình Lịch sử)
router.get('/', verifyToken, projectController.getAllProjects);

// Route lấy chi tiết 1 dự án theo ID (Màn hình Tiến độ / Xem video)
router.get('/:id', verifyToken, projectController.getProjectById);

// Route xóa 1 dự án theo ID
router.delete('/:id', verifyToken, projectController.deleteProject);

module.exports = router;