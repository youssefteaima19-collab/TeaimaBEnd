// services/whatsappService.js
const axios = require("axios");
const { poolPromise } = require("../config/db");

// دالة لجلب رقم الواتساب من الإعدادات
const getWhatsappNumber = async () => {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .query(
      "SELECT setting_value FROM site_settings WHERE setting_key = 'whatsapp_admin_number'",
    );
  return result.recordset[0]?.setting_value || null;
};

const sendWhatsApp = async (
  orderNumber,
  customerName,
  total,
  orderLink = "",
) => {
  try {
    const apiKey = process.env.CALLMEBOT_APIKEY;
    if (!apiKey) {
      console.error("❌ CALLMEBOT_APIKEY missing");
      return;
    }

    const adminPhone = await getWhatsappNumber();
    if (!adminPhone) {
      console.error("❌ WhatsApp admin number not set in database");
      return;
    }

    let message = `🛍️ طلب جديد في متجر طعيمة!\n🔢 رقم الطلب: ${orderNumber}\n👤 العميل: ${customerName || "غير مسجل"}\n💰 الإجمالي: ${total} EGP`;
    if (orderLink) message += `\n📦 التفاصيل: ${orderLink}`;

    const url = `https://api.callmebot.com/whatsapp.php?phone=${adminPhone}&apikey=${apiKey}&text=${encodeURIComponent(message)}`;
    await axios.get(url);
    console.log(`✅ WhatsApp message sent for order ${orderNumber}`);
  } catch (error) {
    console.error("❌ Error sending WhatsApp message:", error.message);
  }
};

module.exports = { sendWhatsApp };
