require("dotenv").config();
const connectDB = require("./config/db");
const Category = require("./models/Category");
const Product = require("./models/Product");
const User = require("./models/User");

const seedData = async () => {
  try {
    await connectDB();
    // حذف البيانات القديمة (اختياري)
    await Category.deleteMany();
    await Product.deleteMany();
    await User.deleteMany();

    // إضافة تصنيفات
    const category = await Category.create({
      name: "شاي",
      slug: "tea",
      description: "جميع أنواع الشاي",
    });

    // إضافة منتج
    await Product.create({
      name: "شاي أخضر",
      slug: "green-tea",
      description: "شاي عضوي",
      categoryId: category._id,
      basePrice: 5.99,
      variants: [
        {
          sku: "GT-100",
          size: "250g",
          color: "أخضر",
          stock: 50,
          priceAdjust: 0,
        },
      ],
      isActive: true,
    });

    // إضافة مستخدم أدمن
    await User.create({
      name: "Admin",
      email: "admin@example.com",
      password: "123456",
      role: "admin",
    });

    console.log("Data seeded successfully");
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seedData();
