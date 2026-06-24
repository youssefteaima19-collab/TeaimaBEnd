const express = require("express");
const router = express.Router();
const { protect, admin } = require("../middleware/auth");
const {
  getAllOrders,
  updateOrderStatus,
  getProductCountBySize,
  getOrderItems,
} = require("../controllers/adminController");

router.get("/orders", protect, admin, getAllOrders);
router.put("/orders/:id/status", protect, admin, updateOrderStatus);
router.get("/stats/sizes", protect, admin, getProductCountBySize);
router.get("/orders/:id/items", protect, admin, getOrderItems);

module.exports = router;
