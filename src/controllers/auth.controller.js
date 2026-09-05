const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
// [POST] Đăng ký tài khoản
const register = async (req, res) => {
  try {
    // Thêm tham số promoCode (tùy chọn) từ request
    // Tự động map 'name' (code cũ) sang 'fullName' (schema mới)
    const { email, password, name, fullName, promoCode } = req.body;
    const finalName = fullName || name || 'Người dùng mới';

    // 1. Kiểm tra user đã tồn tại chưa
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email này đã được sử dụng!' });
    }

    // 2. Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Sử dụng Prisma Transaction để xử lý đa luồng (Tạo user + Tặng khuyến mãi nếu có)
    const newUser = await prisma.$transaction(async (tx) => {
      let initialCredit = 0;
      let validPromo = null;

      // Xử lý mã khuyến mãi nếu người dùng có nhập
      if (promoCode) {
        const promo = await tx.promotion.findUnique({ where: { code: promoCode } });
        const now = new Date();
        
        // Điều kiện: Mã tồn tại, đang active, chưa hết lượt và nằm trong thời gian hợp lệ
        if (promo && promo.isActive && promo.currentUses < promo.maxUses && now >= promo.startDate && now <= promo.endDate) {
          initialCredit = promo.rewardCredits;
          validPromo = promo;
        }
      }

      // 3.1. Tạo User (Lưu ý dùng fullName thay vì name do schema đã đổi)
      const user = await tx.user.create({
        data: {
          email,
          fullName: finalName,
          password: hashedPassword,
          creditBalance: initialCredit // Mặc định 0, hoặc có số dư nếu mã đúng
        },
      });

      // 3.2. Nếu mã khuyến mãi hợp lệ, cập nhật lịch sử hệ thống
      if (validPromo) {
        // Ghi nhận User đã sử dụng mã này
        await tx.promotionRegistration.create({
          data: { userId: user.id, promotionId: validPromo.id }
        });
        
        // Tăng số lượt đã dùng của mã khuyến mãi lên 1
        await tx.promotion.update({
          where: { id: validPromo.id },
          data: { currentUses: { increment: 1 } }
        });

        // Ghi chú vào bảng Lịch sử giao dịch Credit
        await tx.creditTransaction.create({
          data: {
            userId: user.id,
            amount: initialCredit,
            type: 'ADD',
            reason: `Tặng Credit đăng ký từ mã khuyến mãi: ${promoCode}`
          }
        });
      }

      return user;
    });

    res.status(201).json({ 
      message: 'Đăng ký thành công!', 
      userId: newUser.id,
      creditBalance: newUser.creditBalance
    });
  } catch (error) {
    console.error("Lỗi đăng ký: ", error);
    res.status(500).json({ message: 'Lỗi server!' });
  }
};

// [POST] Đăng nhập
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Tìm user theo email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: 'Email hoặc mật khẩu không đúng!' });
    }

    // Kiểm tra xem tài khoản có bị Admin khóa không
    if (!user.isActive) {
      return res.status(403).json({ message: 'Tài khoản của bạn đã bị khóa!' });
    }

    // 2. Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Email hoặc mật khẩu không đúng!' });
    }

    // 3. Tạo JWT Token
    const jwtSecret = process.env.JWT_SECRET || 'super_secret_key_video_ai';
    const token = jwt.sign(
      { userId: user.id, role: user.role }, 
      jwtSecret, 
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Đăng nhập thành công!',
      token,
      // Trả về thêm role và credit để App Mobile tiện hiển thị giao diện
      user: { 
        id: user.id, 
        fullName: user.fullName, 
        email: user.email,
        role: user.role,
        creditBalance: user.creditBalance
      }
    });
  } catch (error) {
    console.error("Lỗi đăng nhập: ", error);
    res.status(500).json({ message: 'Lỗi server!' });
  }
};

const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    
    // 1. Xác thực Token với Google
    const ticket = await client.verifyIdToken({
        idToken: idToken,
        audience: process.env.GOOGLE_CLIENT_ID, 
    });
    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    // 2. Tìm hoặc Tạo user mới
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        user = await prisma.user.create({
            data: {
                email: email,
                fullName: name,
                avatar: picture, // Lấy avatar từ Google
                isActive: true,
                creditBalance: 0
            }
        });
    }

    // 3. Cấp JWT Token của hệ thống mình
    const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );

    res.status(200).json({ message: "Đăng nhập Google thành công", token, user });
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: "Xác thực Google thất bại!" });
  }
};
module.exports = { register, login, googleLogin };