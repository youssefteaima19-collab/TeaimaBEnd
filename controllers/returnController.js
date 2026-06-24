const { poolPromise } = require("../config/db");

// العميل: إنشاء طلب مرتجع لطلب معين
const createReturnRequest = async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    if (!reason || reason.trim() === "") {
      return res.status(400).json({ error: "Reason is required" });
    }

    const pool = await poolPromise;

    // التحقق من أن الطلب مملوك لهذا المستخدم وحالته delivered
    const orderCheck = await pool
      .request()
      .input("orderId", orderId)
      .input("userId", userId)
      .query(
        "SELECT order_status FROM orders WHERE id = @orderId AND user_id = @userId",
      );
    if (orderCheck.recordset.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    const orderStatus = orderCheck.recordset[0].order_status;
    if (orderStatus !== "delivered") {
      return res
        .status(400)
        .json({ error: "Return can only be requested for delivered orders" });
    }

    // التحقق من عدم وجود طلب مرتجع سابق لهذا الطلب
    const existing = await pool
      .request()
      .input("orderId", orderId)
      .query("SELECT id FROM returns WHERE order_id = @orderId");
    if (existing.recordset.length > 0) {
      return res
        .status(400)
        .json({ error: "Return request already submitted for this order" });
    }

    await pool
      .request()
      .input("orderId", orderId)
      .input("userId", userId)
      .input("reason", reason.trim()).query(`
        INSERT INTO returns (order_id, user_id, reason)
        VALUES (@orderId, @userId, @reason)
      `);
    res.status(201).json({ message: "Return request submitted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// العميل: جلب طلبات المرتجع الخاصة به
const getMyReturns = async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = await poolPromise;
    const result = await pool.request().input("userId", userId).query(`
        SELECT r.id, r.order_id, o.order_number, r.reason, r.status, r.requested_at, r.admin_notes
        FROM returns r
        JOIN orders o ON r.order_id = o.id
        WHERE r.user_id = @userId
        ORDER BY r.requested_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// الأدمن: جلب جميع طلبات المرتجع
const getAllReturns = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT r.id, r.order_id, o.order_number, u.name as customer_name, u.email, r.reason, r.status, r.requested_at, r.admin_notes
      FROM returns r
      JOIN orders o ON r.order_id = o.id
      JOIN users u ON r.user_id = u.id
      ORDER BY r.requested_at DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// الأدمن: تحديث حالة طلب المرتجع (قبول/رفض)
const updateReturnStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes, refund_amount } = req.body;
    const validStatuses = ["pending", "approved", "rejected"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const pool = await poolPromise;
    await pool
      .request()
      .input("id", id)
      .input("status", status)
      .input("admin_notes", admin_notes || null)
      .input("refund_amount", refund_amount || null)
      .input("resolved_at", status !== "pending" ? new Date() : null).query(`
        UPDATE returns
        SET status = @status, admin_notes = @admin_notes, refund_amount = @refund_amount, resolved_at = @resolved_at
        WHERE id = @id
      `);
    res.json({ message: "Return status updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createReturnRequest,
  getMyReturns,
  getAllReturns,
  updateReturnStatus,
};
