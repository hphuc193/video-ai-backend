const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');

// [GET] Xem hồ sơ cá nhân
const getProfile = async (req, res) => {
  try {
    const userId = req.user.userId; 
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, fullName: true, creditBalance: true, role: true, createdAt: true,
        avatar: true, dob: true
      }
    });

    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng!" });
    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server khi lấy hồ sơ!" });
  }
};

// [PUT] Cập nhật hồ sơ cá nhân (Tên & Mật khẩu)
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fullName, password, avatar, dob } = req.body;
    let updateData = {};

    if (fullName) updateData.fullName = fullName;
    if (avatar) updateData.avatar = avatar;
    if (dob) updateData.dob = new Date(dob);
    
    // Nếu user gửi password mới thì mã hóa nó
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, email: true, fullName: true, updatedAt: true } // Không trả về password
    });

    res.status(200).json({ message: "Cập nhật hồ sơ thành công!", user: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server khi cập nhật hồ sơ!" });
  }
};

// [GET] Lịch sử giao dịch Credit
const getCreditHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const transactions = await prisma.creditTransaction.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' } // Sắp xếp mới nhất lên đầu
    });

    res.status(200).json({ data: transactions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server khi lấy lịch sử Credit!" });
  }
};

// [GET] Lịch sử tạo Video
const getVideoHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const videos = await prisma.video.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ data: videos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server khi lấy lịch sử Video!" });
  }
};

module.exports = { getProfile, updateProfile, getCreditHistory, getVideoHistory };