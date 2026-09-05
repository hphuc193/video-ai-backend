const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload.middleware');
const verifyToken = require('../middlewares/auth.middleware');
const multer = require('multer');

// Tạo một middleware bao bọc hàm upload để bắt lỗi
const uploadImages = (req, res, next) => {
  const uploadHandler = upload.array('images', 5);
  
  uploadHandler(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      // Lỗi do Multer (vd: file quá lớn, vượt quá 5 file)
      return res.status(400).json({ message: `Lỗi upload: ${err.message}` });
    } else if (err) {
      // Lỗi do bộ lọc fileFilter của chúng ta (không phải file ảnh)
      return res.status(400).json({ message: err.message });
    }
    // Nếu không có lỗi, đi tiếp vào xử lý logic
    next();
  });
};

// Route xử lý upload
router.post('/images', verifyToken, uploadImages, (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'Vui lòng chọn ít nhất 1 ảnh!' });
    }

    const imageUrls = req.files.map(file => {
      return `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
    });

    res.status(200).json({
      message: 'Upload ảnh thành công!',
      urls: imageUrls
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server khi upload ảnh!' });
  }
});

module.exports = router;