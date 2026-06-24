const express = require("express");
const {
  createOrder,
  getMyOrders,
  getOrderById,
  updateOrderItemQuantity,
} = require("../controllers/orderController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.get("/my-orders", protect, getMyOrders);
router.post("/", protect, createOrder);
router.get("/:id", protect, getOrderById);
router.put("/items/:itemId", protect, updateOrderItemQuantity);

module.exports = router;
