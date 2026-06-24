const { poolPromise } = require("../config/db");

// جلب جميع الطلبات (مع بيانات المستخدم)
const getAllOrders = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
        o.id, o.order_number, o.total, o.order_status, o.payment_status,
        o.created_at, o.shipping_address_fullname, o.shipping_address_phone,
        u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// تحديث حالة الطلب مع استرجاع المخزون إذا تم الإلغاء
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = [
      "pending",
      "paid",
      "shipped",
      "delivered",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const pool = await poolPromise;

    // 1. جلب الحالة الحالية للطلب
    const currentOrder = await pool
      .request()
      .input("id", id)
      .query("SELECT order_status FROM orders WHERE id = @id");
    if (currentOrder.recordset.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    const oldStatus = currentOrder.recordset[0].order_status;

    // ✅ منع تغيير الطلب إذا كان ملغي بالفعل
    if (oldStatus === "cancelled") {
      return res.status(400).json({
        error: "❌ هذا الطلب ملغي ولا يمكن تغيير حالته",
      });
    }

    // 2. إذا كانت الحالة الجديدة "cancelled" والحالة القديمة مش "cancelled"
    if (status === "cancelled" && oldStatus !== "cancelled") {
      // جلب عناصر الطلب مع المقاسات والكميات
      const items = await pool.request().input("orderId", id).query(`
          SELECT product_id, size, quantity
          FROM order_items
          WHERE order_id = @orderId
        `);

      // استرجاع المخزون لكل عنصر
      for (const item of items.recordset) {
        // التحقق من وجود المقاس في product_sizes (بدون استخدام id)
        const sizeCheck = await pool
          .request()
          .input("productId", item.product_id)
          .input("size", item.size)
          .query(
            "SELECT 1 FROM product_sizes WHERE product_id = @productId AND size = @size",
          );
        if (sizeCheck.recordset.length > 0) {
          // تحديث المخزون
          await pool
            .request()
            .input("productId", item.product_id)
            .input("size", item.size)
            .input("quantity", item.quantity).query(`
              UPDATE product_sizes
              SET stock = stock + @quantity
              WHERE product_id = @productId AND size = @size
            `);
        }
      }

      // تحديث out_of_stock_since للمنتجات المتأثرة (تنفيذ مباشر)
      for (const item of items.recordset) {
        await pool.request().input("productId", item.product_id).query(`
            UPDATE products 
            SET out_of_stock_since = CASE 
              WHEN (SELECT ISNULL(SUM(stock), 0) FROM product_sizes WHERE product_id = @productId) = 0 
                AND out_of_stock_since IS NULL THEN GETDATE()
              WHEN (SELECT ISNULL(SUM(stock), 0) FROM product_sizes WHERE product_id = @productId) > 0 
                THEN NULL
              ELSE out_of_stock_since
            END
            WHERE id = @productId
          `);
      }
    }

    // 3. تحديث حالة الطلب
    await pool
      .request()
      .input("id", id)
      .input("status", status)
      .query("UPDATE orders SET order_status = @status WHERE id = @id");

    res.json({ message: "Order status updated successfully" });
  } catch (err) {
    console.error("Error updating order status:", err);
    res.status(500).json({ error: err.message });
  }
};

// إحصائيات: عدد المنتجات لكل مقاس
const getProductCountBySize = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
        ps.size,
        COUNT(DISTINCT p.id) AS product_count
      FROM product_sizes ps
      JOIN products p ON ps.product_id = p.id
      WHERE p.is_active = 1
      GROUP BY ps.size
      ORDER BY 
        CASE 
          WHEN ps.size = 'S' THEN 1
          WHEN ps.size = 'M' THEN 2
          WHEN ps.size = 'L' THEN 3
          WHEN ps.size = 'XL' THEN 4
          WHEN ps.size = '2XL' THEN 5
          WHEN ps.size = '3XL' THEN 6
          WHEN ps.size = '4XL' THEN 7
          WHEN ps.size = '5XL' THEN 8
          WHEN ps.size = '6XL' THEN 9
          ELSE 10
        END
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// جلب عناصر طلب معين
const getOrderItems = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    const result = await pool.request().input("orderId", id).query(`
        SELECT 
          oi.id,
          oi.product_id,
          oi.quantity,
          oi.price,
          oi.size,
          oi.color,
          oi.product_name_snapshot,
          oi.product_image_snapshot
        FROM order_items oi
        WHERE oi.order_id = @orderId
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAllOrders,
  updateOrderStatus,
  getProductCountBySize,
  getOrderItems,
};
