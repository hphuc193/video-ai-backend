const prisma = require('../config/prisma');

// 1. [GET] Lấy thống kê báo cáo cho Dashboard
const getDashboardStats = async (req, res) => {
  try {
    // 1. Thống kê cơ bản
    const totalUsers = await prisma.user.count();
    const totalVideos = await prisma.video.count();
    
    // 2. Thống kê trạng thái Video (Thêm Failed để giám sát lỗi hệ thống)
    const successfulVideos = await prisma.video.count({ where: { status: 'SUCCESS' } });
    const failedVideos = await prisma.video.count({ where: { status: 'FAILED' } });

    // 3. Tính tổng doanh thu tiền thật (USD)
    const payments = await prisma.payment.aggregate({
      _sum: { amountPaid: true },
      where: { paymentStatus: 'SUCCESS' }
    });
    const totalRevenue = payments._sum.amountPaid || 0;

    // 4. Thống kê Khuyến mãi & Gói Credit (Chỉ đếm những cái đang kích hoạt)
    const activePackages = await prisma.creditPackage.count({ where: { isActive: true } });
    const activePromotions = await prisma.promotion.count({ where: { isActive: true } });

    // 5. Tính tổng số dư Credit đang lưu hành của toàn bộ User
    const usersCredit = await prisma.user.aggregate({
      _sum: { creditBalance: true }
    });
    const totalOutstandingCredits = usersCredit._sum.creditBalance || 0;

    // Trả về toàn bộ dữ liệu trong 1 cục duy nhất
    res.status(200).json({
      data: {
        totalUsers,
        totalVideos,
        successfulVideos,
        failedVideos,
        totalRevenue,
        activePackages,
        activePromotions,
        totalOutstandingCredits
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi lấy thống kê báo cáo!" });
  }
};

// 2. [GET] Lấy danh sách toàn bộ User
const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, fullName: true, role: true, creditBalance: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ data: users });
  } catch (error) {
    res.status(500).json({ message: "Lỗi lấy danh sách User!" });
  }
};

// 3. [PATCH] Khóa / Mở khóa tài khoản User
const toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
    
    if (!user) return res.status(404).json({ message: "Không tìm thấy User!" });
    if (user.role === 'ADMIN') return res.status(400).json({ message: "Không thể khóa tài khoản Admin khác!" });

    const updatedUser = await prisma.user.update({
      where: { id: Number(userId) },
      data: { isActive: !user.isActive },
      select: { id: true, email: true, isActive: true }
    });

    res.status(200).json({ 
      message: updatedUser.isActive ? "Đã mở khóa tài khoản!" : "Đã khóa tài khoản!", 
      user: updatedUser 
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi cập nhật trạng thái User!" });
  }
};

// 4. [POST] Admin tự tay cộng/trừ Credit cho User
const adjustUserCredit = async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, reason } = req.body; // amount có thể là số âm (để trừ) hoặc dương (để cộng)

    if (!amount || !reason) return res.status(400).json({ message: "Vui lòng nhập số tiền và lý do!" });

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: Number(userId) } });
      if (!user) throw new Error("USER_NOT_FOUND");
      
      // Đảm bảo không bị âm tiền
      if (amount < 0 && user.creditBalance < Math.abs(amount)) {
        throw new Error("NOT_ENOUGH_CREDIT");
      }

      await tx.user.update({
        where: { id: Number(userId) },
        data: { creditBalance: { increment: amount } }
      });

      await tx.creditTransaction.create({
        data: {
          userId: Number(userId),
          amount: Math.abs(amount),
          type: amount > 0 ? 'ADD' : 'DEDUCT',
          reason: `Admin: ${reason}`
        }
      });
    });

    res.status(200).json({ message: "Điều chỉnh Credit thành công!" });
  } catch (error) {
    if (error.message === "USER_NOT_FOUND") return res.status(404).json({ message: "Không tìm thấy User!" });
    if (error.message === "NOT_ENOUGH_CREDIT") return res.status(400).json({ message: "Tài khoản User không đủ tiền để trừ!" });
    res.status(500).json({ message: "Lỗi khi điều chỉnh Credit!" });
  }
};

// ==========================================
// QUẢN LÝ CẤU HÌNH (SETTINGS)
// ==========================================

// [GET] Xem tất cả cấu hình
const getSettings = async (req, res) => {
  try {
    const settings = await prisma.setting.findMany();
    res.status(200).json({ data: settings });
  } catch (error) {
    res.status(500).json({ message: "Lỗi lấy danh sách cấu hình!" });
  }
};

// [PUT] Cập nhật cấu hình (VD: Thay đổi chi phí tạo Video)
const updateSetting = async (req, res) => {
  try {
    const { key, value, description } = req.body;
    
    // Dùng upsert: Nếu key đã có thì update, chưa có thì tạo mới
    const setting = await prisma.setting.upsert({
      where: { key },
      update: { value: String(value), description },
      create: { key, value: String(value), description }
    });

    res.status(200).json({ message: "Cập nhật cấu hình thành công!", data: setting });
  } catch (error) {
    res.status(500).json({ message: "Lỗi cập nhật cấu hình!" });
  }
};

// ==========================================
// QUẢN LÝ KHUYẾN MÃI & GÓI CREDIT (ADMIN)
// ==========================================

// [POST] Tạo gói Credit mới để bán
const createCreditPackage = async (req, res) => {
  try {
    const { name, price, credits } = req.body;
    const newPackage = await prisma.creditPackage.create({
      data: { name, price: Number(price), credits: Number(credits) }
    });
    res.status(201).json({ message: "Tạo gói Credit thành công!", data: newPackage });
  } catch (error) {
    res.status(500).json({ message: "Lỗi tạo gói Credit!" });
  }
};

// [POST] Tạo chương trình khuyến mãi mới
const createPromotion = async (req, res) => {
  try {
    const { code, rewardCredits, maxUses, startDate, endDate } = req.body;
    
    const newPromo = await prisma.promotion.create({
      data: {
        code,
        rewardCredits: Number(rewardCredits),
        maxUses: Number(maxUses),
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      }
    });
    res.status(201).json({ message: "Tạo khuyến mãi thành công!", data: newPromo });
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ message: "Mã khuyến mãi này đã tồn tại!" });
    res.status(500).json({ message: "Lỗi tạo mã khuyến mãi!" });
  }
};

// [GET] Xem tất cả gói Credit (Kể cả bị ẩn)
const getAllPackagesAdmin = async (req, res) => {
  try {
    const packages = await prisma.creditPackage.findMany({ orderBy: { price: 'asc' } });
    res.status(200).json({ data: packages });
  } catch (error) {
    res.status(500).json({ message: "Lỗi lấy danh sách gói Credit!" });
  }
};

// [GET] Xem tất cả khuyến mãi (Kể cả hết hạn)
const getAllPromotionsAdmin = async (req, res) => {
  try {
    const promos = await prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
    res.status(200).json({ data: promos });
  } catch (error) {
    res.status(500).json({ message: "Lỗi lấy danh sách khuyến mãi!" });
  }
};

// [PATCH] Kích hoạt/Vô hiệu hóa một gói Credit
const togglePackageStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const package = await prisma.creditPackage.findUnique({ where: { id: Number(id) } });
    
    if (!package) return res.status(404).json({ message: "Không tìm thấy gói Credit!" });

    const updatedPackage = await prisma.creditPackage.update({
      where: { id: Number(id) },
      data: { isActive: !package.isActive }
    });

    res.status(200).json({ 
      message: updatedPackage.isActive ? "Đã kích hoạt gói Credit!" : "Đã vô hiệu hóa gói Credit!",
      data: updatedPackage 
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi cập nhật trạng thái gói!" });
  }
};

// [PATCH] Kích hoạt/Vô hiệu hóa một mã Khuyến mãi
const togglePromotionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const promo = await prisma.promotion.findUnique({ where: { id: Number(id) } });
    
    if (!promo) return res.status(404).json({ message: "Không tìm thấy khuyến mãi!" });

    const updatedPromo = await prisma.promotion.update({
      where: { id: Number(id) },
      data: { isActive: !promo.isActive }
    });

    res.status(200).json({ 
      message: updatedPromo.isActive ? "Đã kích hoạt khuyến mãi!" : "Đã vô hiệu hóa khuyến mãi!",
      data: updatedPromo 
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi cập nhật trạng thái khuyến mãi!" });
  }
};

// 5. [PATCH] Thay đổi vai trò (Role) của User
const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body; // Chỉ nhận 'USER' hoặc 'ADMIN'

    // 1. Kiểm tra đầu vào
    if (!['USER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ message: "Vai trò không hợp lệ!" });
    }

    // 2. Tìm user
    const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
    if (!user) return res.status(404).json({ message: "Không tìm thấy User!" });

    // 3. CHỐT AN TOÀN: Ngăn Admin tự thay đổi quyền của chính mình
    if (user.id === req.user.userId) {
      return res.status(400).json({ message: "Bạn không thể tự thay đổi quyền của chính mình!" });
    }

    // 4. Cập nhật role
    const updatedUser = await prisma.user.update({
      where: { id: Number(userId) },
      data: { role },
      select: { id: true, email: true, role: true }
    });

    res.status(200).json({ 
      message: `Đã cấp quyền ${role} cho tài khoản thành công!`, 
      user: updatedUser 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi khi cập nhật quyền User!" });
  }
};


module.exports = { getDashboardStats, getAllUsers, toggleUserStatus, adjustUserCredit, getSettings, updateSetting, createCreditPackage, createPromotion, getAllPackagesAdmin, getAllPromotionsAdmin, togglePackageStatus, togglePromotionStatus, updateUserRole };