const prisma = require('../config/prisma');

// ==========================================
// QUẢN LÝ GÓI CREDIT & THANH TOÁN
// ==========================================

// [GET] Lấy danh sách các gói Credit đang bán  
const getPackages = async (req, res) => {
  try {
    const packages = await prisma.creditPackage.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' }
    });
    res.status(200).json({ data: packages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi khi lấy danh sách gói Credit!" });
  }
};

// [POST] Mua gói Credit (Mô phỏng thanh toán thành công)
const buyPackage = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { packageId } = req.body;

    // 1. Kiểm tra gói có tồn tại và đang bán không
    const creditPackage = await prisma.creditPackage.findUnique({
      where: { id: packageId }
    });

    if (!creditPackage || !creditPackage.isActive) {
      return res.status(404).json({ message: "Gói Credit không tồn tại hoặc đã ngừng bán!" });
    }

    // 2. Dùng Transaction để thực hiện nghiệp vụ cộng tiền an toàn
    await prisma.$transaction(async (tx) => {
      // 2.1 Tạo hóa đơn thanh toán
      await tx.payment.create({
        data: {
          userId,
          packageId,
          amountPaid: creditPackage.price,
          paymentStatus: 'SUCCESS' // Mô phỏng thanh toán luôn thành công
        }
      });

      // 2.2 Cộng Credit cho User
      await tx.user.update({
        where: { id: userId },
        data: { creditBalance: { increment: creditPackage.credits } }
      });

      // 2.3 Ghi lịch sử biến động số dư
      await tx.creditTransaction.create({
        data: {
          userId,
          amount: creditPackage.credits,
          type: 'ADD',
          reason: `Mua gói ${creditPackage.name}`
        }
      });
    });

    res.status(200).json({ message: `Thanh toán thành công. Đã cộng ${creditPackage.credits} Credit vào tài khoản!` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server khi thanh toán!" });
  }
};

// ==========================================
// QUẢN LÝ KHUYẾN MÃI (PROMOTION)
// ==========================================

// [GET] Xem các chương trình khuyến mãi đang diễn ra
const getActivePromotions = async (req, res) => {
  try {
    const now = new Date();
    const promotions = await prisma.promotion.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now }
      }
    });
    res.status(200).json({ data: promotions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi lấy danh sách khuyến mãi!" });
  }
};

// [POST] Nhập mã khuyến mãi (Dành cho User cũ muốn nhập mã)
const applyPromotion = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { code } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Tìm mã khuyến mãi
      const promo = await tx.promotion.findUnique({ where: { code } });
      const now = new Date();

      if (!promo || !promo.isActive) throw new Error("INVALID_CODE");
      if (now < promo.startDate || now > promo.endDate) throw new Error("EXPIRED_CODE");
      if (promo.currentUses >= promo.maxUses) throw new Error("MAX_USES_REACHED");

      // 2. Kiểm tra user này đã dùng mã này chưa
      const alreadyUsed = await tx.promotionRegistration.findUnique({
        where: {
          userId_promotionId: { userId, promotionId: promo.id }
        }
      });
      if (alreadyUsed) throw new Error("ALREADY_USED");

      // 3. Thực hiện cộng tiền và ghi nhận
      await tx.promotionRegistration.create({
        data: { userId, promotionId: promo.id }
      });

      await tx.promotion.update({
        where: { id: promo.id },
        data: { currentUses: { increment: 1 } }
      });

      await tx.user.update({
        where: { id: userId },
        data: { creditBalance: { increment: promo.rewardCredits } }
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          amount: promo.rewardCredits,
          type: 'ADD',
          reason: `Sử dụng mã khuyến mãi: ${code}`
        }
      });

      return promo.rewardCredits;
    });

    res.status(200).json({ message: `Áp dụng mã thành công! Bạn nhận được ${result} Credit.` });
  } catch (error) {
    const errorMap = {
      "INVALID_CODE": "Mã khuyến mãi không hợp lệ!",
      "EXPIRED_CODE": "Mã khuyến mãi đã hết hạn hoặc chưa bắt đầu!",
      "MAX_USES_REACHED": "Mã khuyến mãi đã hết lượt sử dụng!",
      "ALREADY_USED": "Bạn đã sử dụng mã khuyến mãi này rồi!"
    };
    if (errorMap[error.message]) {
      return res.status(400).json({ message: errorMap[error.message] });
    }
    console.error(error);
    res.status(500).json({ message: "Lỗi khi áp dụng mã khuyến mãi!" });
  }
};

module.exports = { getPackages, buyPackage, getActivePromotions, applyPromotion };