const express = require("express");
const router = express.Router();
const { getAllCategories } = require("../controllers/categoryController");
const { protect, admin } = require("../middleware/auth");

// يمكن جعل المسار عامًا (لأن التصنيفات تظهر للمستخدم العادي أيضاً)
router.get("/", getAllCategories); // أو أضف protect إذا أردت حمايته

module.exports = router;
