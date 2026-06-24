const express = require("express");
const router = express.Router();
const { protect, admin } = require("../middleware/auth");
const {
  createReturnRequest,
  getMyReturns,
  getAllReturns,
  updateReturnStatus,
} = require("../controllers/returnController");

// مسارات العميل
router.post("/orders/:id/return", protect, createReturnRequest);
router.get("/my-returns", protect, getMyReturns);

// مسارات الأدمن
router.get("/admin/returns", protect, admin, getAllReturns);
router.put("/admin/returns/:id/status", protect, admin, updateReturnStatus);

module.exports = router;
