const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// BỘ LỌC ĐÃ ĐƯỢC NÂNG CẤP (Kiểm tra bằng đuôi file)
const fileFilter = (req, file, cb) => {
  // Lấy đuôi file và chuyển thành chữ thường (vd: .jpg, .png)
  const ext = path.extname(file.originalname).toLowerCase();
  
  // Danh sách các đuôi ảnh cho phép
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

  if (allowedExtensions.includes(ext)) {
    cb(null, true); // Cho phép qua
  } else {
    cb(new Error('Chỉ được phép upload file định dạng hình ảnh (.jpg, .png, .webp)!'), false); // Chặn lại
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = upload;