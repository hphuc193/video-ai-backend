const prisma = require('../config/prisma');
const axios = require('axios');

// BẢNG GIÁ MODEL (Quy đổi: 1 Credit = 0.01$ = 1 cent)
const MODEL_PRICING = {
  "veo-3.1-generate-preview": { "720p": 40, "1080p": 40, "4k": 60 },
  "veo-3.1-fast-generate-preview": { "720p": 10, "1080p": 12, "4k": 30 },
  "veo-3.1-lite-generate-preview": { "720p": 5, "1080p": 8, "4k": 8 } 
};

// [POST] Tạo dự án video
const createProject = async (req, res) => {
  try {
    const { prompt_idea, images, settings } = req.body;
    const userId = req.user.userId;

    if (!images || images.length === 0) return res.status(400).json({ message: 'Cần ít nhất 1 ảnh!' });

    // 1. Gán giá trị mặc định
    const model = settings.model || "veo-3.1-lite-generate-preview";
    const duration = settings.duration_seconds || 8;
    const resolution = settings.resolution || "720p";
    const aspect_ratio = settings.aspect_ratio || "16:9";

    // 2. Logic Validation
    if ((duration === 4 || duration === 6) && resolution !== "720p") {
      return res.status(400).json({ message: 'Thời lượng 4s/6s chỉ hỗ trợ 720p!' });
    }

    // 3. Tính toán chi phí
    const pricePerSec = MODEL_PRICING[model][resolution];
    if (!pricePerSec) return res.status(400).json({ message: 'Cấu hình model không hợp lệ!' });
    const totalCreditCost = pricePerSec * duration;

    // 4. KIỂM TRA SỐ DƯ TÀI KHOẢN
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.creditBalance < totalCreditCost) {
      return res.status(400).json({ message: 'Số dư Credit không đủ để tạo video này!' });
    }

    // 5. TRANSACTION: Vừa tạo Video, vừa Trừ tiền, vừa Ghi lịch sử (Chạy đồng thời)
    const [newProject, updatedUser, transaction] = await prisma.$transaction([
      // 5.1 Tạo Video (Đã sửa status thành PENDING theo đúng Schema)
      prisma.video.create({
        data: {
          userId: userId,
          prompt: prompt_idea,
          status: 'PENDING',
          creditCost: totalCreditCost
        }
      }),
      // 5.2 Trừ tiền User
      prisma.user.update({
        where: { id: userId },
        data: { creditBalance: { decrement: totalCreditCost } }
      }),
      // 5.3 Ghi nhận lịch sử giao dịch
      prisma.creditTransaction.create({
        data: {
          userId: userId,
          amount: totalCreditCost,
          type: 'DEDUCT',
          reason: `Tạo video AI - Model: ${model}`
        }
      })
    ]);

    res.status(201).json({
      message: 'Đã tạo dự án, hệ thống đang render!',
      project: newProject,
      remainingBalance: updatedUser.creditBalance // Trả về số dư mới cho Mobile hiển thị
    });

    // 6. Gửi Lệnh sang Server FastAPI
    axios.post('http://localhost:8000/api/generate', {
      projectId: newProject.id,
      images: images,
      prompt_idea: prompt_idea,
      settings: { model, duration, resolution, aspect_ratio }
    }).catch(err => console.error("Lỗi gửi sang FastAPI:", err.message));

  } catch (error) {
    console.error('Lỗi khi tạo project:', error);
    res.status(500).json({ message: 'Lỗi server!' });
  }
};

// [POST] Webhook - Nhận kết quả trả về từ FastAPI
const webhookUpdateVideo = async (req, res) => {
  try {
    const { projectId, status, videoUrl, message } = req.body;
    
    // Ép kiểu status từ Python ('completed'/'failed') sang chuẩn Prisma (SUCCESS/FAILED)
    const dbStatus = status === 'completed' ? 'SUCCESS' : 'FAILED';
    
    // Cập nhật trạng thái video
    const project = await prisma.video.update({
      where: { id: projectId },
      data: {
        status: dbStatus,
        videoUrl: videoUrl,
      }
    });

    // LOGIC HOÀN TIỀN CỰC HAY: Nếu Google lỗi, trả lại tiền cho người dùng!
    if (dbStatus === 'FAILED' && project) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: project.userId },
          data: { creditBalance: { increment: project.creditCost } }
        }),
        prisma.creditTransaction.create({
          data: {
            userId: project.userId,
            amount: project.creditCost,
            type: 'ADD',
            reason: `Hoàn tiền video lỗi hệ thống #${project.id}`
          }
        })
      ]);
      console.log(`⚠️ Webhook: Video ${projectId} LỖI. Đã hoàn lại ${project.creditCost} Credit cho User ${project.userId}.`);
    } else {
      console.log(`✅ Webhook: Project ${projectId} đã cập nhật trạng thái SUCCESS`);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Lỗi Webhook:', error);
    res.status(500).send('Lỗi Webhook');
  }
};

// [GET] Lấy danh sách tất cả dự án
const getAllProjects = async (req, res) => {
  try {
    const userId = req.user.userId;
    const projects = await prisma.video.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' }, 
    });
    res.status(200).json({ projects });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách:', error);
    res.status(500).json({ message: 'Lỗi server!' });
  }
};

// [GET] Lấy chi tiết 1 dự án
const getProjectById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectId = parseInt(req.params.id);

    const project = await prisma.video.findFirst({
      where: { 
        id: projectId,
        userId: userId 
      }
    });

    if (!project) {
      return res.status(404).json({ message: 'Không tìm thấy dự án!' });
    }

    res.status(200).json({ project });
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết dự án:', error);
    res.status(500).json({ message: 'Lỗi server!' });
  }
};

// [DELETE] Xóa 1 dự án
const deleteProject = async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectId = parseInt(req.params.id);

    const project = await prisma.video.findFirst({
      where: { id: projectId, userId: userId }
    });

    if (!project) {
      return res.status(404).json({ message: 'Không tìm thấy dự án để xóa!' });
    }

    await prisma.video.delete({
      where: { id: projectId }
    });

    res.status(200).json({ message: 'Đã xóa dự án thành công!' });
  } catch (error) {
    console.error('Lỗi khi xóa:', error);
    res.status(500).json({ message: 'Lỗi server!' });
  }
};

module.exports = { 
  createProject, 
  getAllProjects, 
  getProjectById, 
  deleteProject,
  webhookUpdateVideo,
};