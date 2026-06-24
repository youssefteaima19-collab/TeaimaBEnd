const express = require("express");
const cors = require("cors");
require("dotenv").config();
const connectDB = require("./config/db");
const { protect, admin } = require("./middleware/auth");

const app = express();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

app.use("/uploads", express.static("uploads"));

// التأكد من وجود مجلد uploads (إن لم يكن موجوداً)
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// إعداد تخزين الملفات
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// فلترة الملفات (فقط الصور)
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only images are allowed"), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // حد أقصى 5 ميجابايت
  fileFilter: fileFilter,
});

// جعل مجلد uploads متاحاً للوصول العام
app.use("/uploads", express.static("uploads"));

// يمكنك تصدير upload لاستخدامه في الـ routes
module.exports.upload = upload;
const PORT = process.env.PORT || 5000;

// اتصال بقاعدة البيانات
connectDB();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());

// استيراد الـ routes
const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const categoryRoutes = require("./routes/categoryRoutes");

// تعليق المسارات
app.use("/api/auth", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/categories", categoryRoutes);
const siteSettingsRoutes = require("./routes/siteSettingsRoutes");
app.use("/api/site-settings", siteSettingsRoutes);

// إضافة مسار لرفع الصور (للألوان أو أي صور إضافية)
app.post("/api/upload", protect, admin, upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ url: imageUrl });
});

// مسار تجريبي
app.get("/api/health", (req, res) => res.json({ status: "OK" }));

// معالج الأخطاء العام
const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

const adminRoutes = require("./routes/adminRoutes");
app.use("/api/admin", adminRoutes);
const returnRoutes = require("./routes/returnRoutes");
app.use("/api", returnRoutes);

const cron = require("node-cron");
const { poolPromise } = require("./config/db");

cron.schedule("0 0 * * *", async () => {
  console.log(
    "🕒 Running cron: delete out-of-stock products older than 15 days",
  );
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      DELETE FROM products 
      WHERE out_of_stock_since IS NOT NULL 
        AND out_of_stock_since < DATEADD(day, -15, GETDATE())
    `);
    console.log(`✅ Deleted ${result.rowsAffected} products`);
  } catch (err) {
    console.error("❌ Cron job error:", err);
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
