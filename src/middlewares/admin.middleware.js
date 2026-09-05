// Middleware này phải được đặt SAU middleware verifyToken (auth)
const isAdmin = (req, res, next) => {
  try {
    // Biến req.user được tạo ra từ middleware verifyToken trước đó
    if (!req.user || req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: "Truy cập bị từ chối! Chỉ Admin mới có quyền thực hiện." });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: "Lỗi kiểm tra quyền Admin!" });
  }
};

module.exports = isAdmin;