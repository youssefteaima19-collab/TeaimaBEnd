const express = require("express");
const router = express.Router();
const {
  getSiteSettings,
  updateBackgroundSettings,
  updateWhatsappNumber,
  updateHeroImageWithFile,
  updateHeroImage,
  getReturnPolicy,
  updateReturnPolicy,
  getShippingFee,
  updateShippingFee,
} = require("../controllers/siteSettingsController");
const { protect, admin } = require("../middleware/auth");

const multer = require("multer");
const path = require("path");

// إعداد تخزين الملفات (يمكنك استخدام نفس إعدادات multer من server.js)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "hero-" + uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.get("/return-policy", getReturnPolicy);
router.put("/return-policy", protect, admin, updateReturnPolicy);
router.get("/shipping-fee", getShippingFee);
router.put("/shipping-fee", protect, admin, updateShippingFee);

// إضافة المسار مع middleware رفع الملف
router.post(
  "/hero-upload",
  protect,
  admin,
  upload.single("hero_image"),
  updateHeroImageWithFile,
);

router.get("/", getSiteSettings); // عام
router.put("/whatsapp", protect, admin, updateWhatsappNumber); // للأدمن فقط
router.put("/background", protect, admin, updateBackgroundSettings);
router.put("/hero", protect, admin, updateHeroImage);
module.exports = router;
