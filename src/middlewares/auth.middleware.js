const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  // Lấy token từ header (Định dạng: Bearer <token>)
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Không tìm thấy Token. Từ chối truy cập!' });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'super_secret_key_video_ai';
    // Giải mã token, lấy ra thông tin user đã mã hóa lúc login
    const decoded = jwt.verify(token, jwtSecret);
    
    // Gắn thông tin userId vào request để các API sau sử dụng
    req.user = decoded; 
    next(); // Cho phép đi tiếp vào Controller
  } catch (error) {
    return res.status(403).json({ message: 'Token không hợp lệ hoặc đã hết hạn!' });
  }
};

module.exports = verifyToken;