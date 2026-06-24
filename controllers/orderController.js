const { poolPromise, sql } = require("../config/db");
const bcrypt = require("bcryptjs");
const { sendWhatsApp } = require("../services/whatsappService");

async function getOrCreateGuestUser(email, name, phone) {
  const pool = await poolPromise;
  if (email) {
    const existing = await pool
      .request()
      .input("email", email)
      .query("SELECT id FROM users WHERE email = @email");
    if (existing.recordset[0]) return existing.recordset[0].id;
  }
  const guestEmail =
    email ||
    `guest_${Date.now()}_${Math.random().toString(36).substr(2, 8)}@temp.com`;
  const guestName = name || "Guest";
  const guestPhone = phone || "";
  const randomPassword = Math.random().toString(36).substring(2, 15);
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(randomPassword, salt);

  const result = await pool
    .request()
    .input("name", guestName)
    .input("email", guestEmail)
    .input("password", hashedPassword)
    .input("phone", guestPhone).query(`
      INSERT INTO users (name, email, password, phone, role, created_at)
      VALUES (@name, @email, @password, @phone, 'guest', GETDATE());
      SELECT SCOPE_IDENTITY() AS id;
    `);
  return result.recordset[0].id;
}

const createOrder = async (req, res) => {
  try {
    const { items, total, customerName, customerPhone, address, email, city } =
      req.body;
    const pool = await poolPromise;

    // 1. التحقق من صحة المنتجات والمخزون (لكل مقاس)
    for (const item of items) {
      // التحقق من وجود المنتج نفسه وسعره
      const productCheck = await pool
        .request()
        .input("productId", item.productId)
        .query(
          "SELECT id, price FROM products WHERE id = @productId AND is_active = 1",
        );
      if (productCheck.recordset.length === 0) {
        return res
          .status(400)
          .json({ error: `Product ${item.productId} not found or inactive` });
      }
      const product = productCheck.recordset[0];
      item.price = product.price; // منع التلاعب بالسعر

      // التحقق من وجود المقاس المختار وكميته في product_sizes
      const sizeCheck = await pool
        .request()
        .input("productId", item.productId)
        .input("size", item.size)
        .query(
          "SELECT stock FROM product_sizes WHERE product_id = @productId AND size = @size",
        );
      if (sizeCheck.recordset.length === 0) {
        return res.status(400).json({
          error: `Size ${item.size} not available for product ${item.productId}`,
        });
      }
      const stock = sizeCheck.recordset[0].stock;
      if (stock < item.quantity) {
        return res.status(400).json({
          error: `Insufficient stock for product ${item.productId}, size ${item.size}`,
        });
      }
    }

    const orderNumber =
      "ORD-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    let userId;
    if (req.user && req.user.id) {
      userId = req.user.id;
    } else {
      userId = await getOrCreateGuestUser(email, customerName, customerPhone);
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const orderInsert = await transaction
        .request()
        .input("orderNumber", orderNumber)
        .input("userId", userId)
        .input("subtotal", total)
        .input("shippingCost", 0)
        .input("discount", 0)
        .input("tax", 0)
        .input("total", total)
        .input("orderStatus", "pending")
        .input("paymentStatus", "pending")
        .input("paymentMethod", "cash_on_delivery")
        .input("shippingMethod", "standard")
        .input("shippingAddressFullname", customerName || "Guest")
        .input("shippingAddressPhone", customerPhone || "")
        .input("shippingAddressAddress", address || "")
        .input("shippingAddressCity", city || "القاهرة")
        .input("contactEmail", email || "")
        .input("contactPhone", customerPhone || "").query(`
          INSERT INTO orders (
            order_number, user_id, subtotal, shipping_cost, discount, tax, total,
            order_status, payment_status, payment_method, shipping_method,
            shipping_address_fullname, shipping_address_phone, shipping_address_address,
            shipping_address_city, contact_email, contact_phone
          ) VALUES (
            @orderNumber, @userId, @subtotal, @shippingCost, @discount, @tax, @total,
            @orderStatus, @paymentStatus, @paymentMethod, @shippingMethod,
            @shippingAddressFullname, @shippingAddressPhone, @shippingAddressAddress,
            @shippingAddressCity, @contactEmail, @contactPhone
          );
          SELECT SCOPE_IDENTITY() AS orderId;
        `);
      const orderId = orderInsert.recordset[0].orderId;

      for (const item of items) {
        await transaction
          .request()
          .input("orderId", orderId)
          .input("productId", item.productId)
          .input("quantity", item.quantity)
          .input("price", item.price)
          .input("size", item.size || "")
          .input("color", item.color || "")
          .input("productNameSnapshot", item.name)
          .input("productImageSnapshot", item.image || "").query(`
            INSERT INTO order_items (
              order_id, product_id, quantity, price, size, color,
              product_name_snapshot, product_image_snapshot
            ) VALUES (
              @orderId, @productId, @quantity, @price, @size, @color,
              @productNameSnapshot, @productImageSnapshot
            );
          `);

        await transaction
          .request()
          .input("productId", item.productId)
          .input("size", item.size)
          .input("quantity", item.quantity).query(`
            UPDATE product_sizes 
            SET stock = stock - @quantity 
            WHERE product_id = @productId AND size = @size
          `);
      }

      await transaction.commit();
      const orderLink = `https://teaima-store.com/admin/orders/${orderId}`;
      await sendWhatsApp(orderNumber, customerName, total, orderLink);
      res.status(201).json({ success: true, orderId, orderNumber });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error("❌ Order creation error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ جلب طلبات المستخدم الحالي (للعميل)
const getMyOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = await poolPromise;
    const result = await pool.request().input("userId", userId).query(`
        SELECT 
          id, order_number, total, order_status, payment_status, 
          created_at, shipping_address_fullname
        FROM orders
        WHERE user_id = @userId
        ORDER BY created_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ جلب تفاصيل طلب معين مع عناصره (يتحقق من ملكية المستخدم)
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const pool = await poolPromise;

    // جلب الطلب نفسه
    const orderRes = await pool
      .request()
      .input("id", id)
      .input("userId", userId).query(`
        SELECT * FROM orders 
        WHERE id = @id AND user_id = @userId
      `);
    if (orderRes.recordset.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    const order = orderRes.recordset[0];

    // جلب عناصر الطلب
    const itemsRes = await pool.request().input("orderId", id).query(`
        SELECT 
          product_id, quantity, price, size, color, 
          product_name_snapshot, product_image_snapshot
        FROM order_items
        WHERE order_id = @orderId
      `);
    order.items = itemsRes.recordset;

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// controllers/orderController.js

const updateOrderItemQuantity = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;

    // 1. تحديث الكمية في جدول order_items
    await db.query("UPDATE order_items SET quantity = ? WHERE id = ?", [
      quantity,
      itemId,
    ]);

    // 2. (اختياري) إعادة حساب total للطلب
    // يمكنك جلب order_id من item ثم إعادة حساب مجموع الأسعار

    res.json({ message: "Quantity updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  updateOrderItemQuantity,
};
