const { poolPromise } = require("../config/db");

// جلب كل الإعدادات (زي ما هي موجودة)
const getSiteSettings = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query("SELECT setting_key, setting_value FROM site_settings");
    const settings = {};
    result.recordset.forEach((row) => {
      settings[row.setting_key] = row.setting_value;
    });
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// تحديث إعدادات الخلفية (يمكن أن ترسل كائن واحد)
const updateBackgroundSettings = async (req, res) => {
  try {
    const { bg_type, bg_color, bg_image } = req.body;
    const pool = await poolPromise;

    if (bg_type !== undefined) {
      await pool
        .request()
        .input("key", "background_type")
        .input("value", bg_type)
        .query(
          `UPDATE site_settings SET setting_value = @value, updated_at = GETDATE() WHERE setting_key = @key`,
        );
    }
    if (bg_color !== undefined) {
      await pool
        .request()
        .input("key", "background_color")
        .input("value", bg_color)
        .query(
          `UPDATE site_settings SET setting_value = @value WHERE setting_key = @key`,
        );
    }
    if (bg_image !== undefined) {
      await pool
        .request()
        .input("key", "background_image")
        .input("value", bg_image)
        .query(
          `UPDATE site_settings SET setting_value = @value WHERE setting_key = @key`,
        );
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// تحديث رقم الواتساب
const updateWhatsappNumber = async (req, res) => {
  try {
    const { value } = req.body;
    if (!value) return res.status(400).json({ error: "Number is required" });
    const pool = await poolPromise;
    await pool
      .request()
      .input("key", "whatsapp_admin_number")
      .input("value", value).query(`
        UPDATE site_settings 
        SET setting_value = @value, updated_at = GETDATE()
        WHERE setting_key = @key
      `);
    res.json({ success: true, message: "WhatsApp number updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

const updateHeroImageWithFile = async (req, res) => {
  try {
    const imageFile = req.file;
    if (!imageFile) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const imageUrl = `/uploads/${imageFile.filename}`;
    const pool = await poolPromise;
    await pool
      .request()
      .input("key", "hero_image_url")
      .input("value", imageUrl)
      .query(
        `UPDATE site_settings SET setting_value = @value, updated_at = GETDATE() WHERE setting_key = @key`,
      );
    res.json({ success: true, imageUrl: imageUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

const updateHeroImage = async (req, res) => {
  try {
    const { value } = req.body;
    if (!value) return res.status(400).json({ error: "Image URL is required" });
    const pool = await poolPromise;
    await pool
      .request()
      .input("key", "hero_image_url")
      .input("value", value)
      .query(
        `UPDATE site_settings SET setting_value = @value, updated_at = GETDATE() WHERE setting_key = @key`,
      );
    res.json({ success: true, message: "Hero image updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// جلب سياسة المرتجع (يمكن استخدام getSiteSettings لكننا سنضيف دالة منفصلة للتوضيح)
const getReturnPolicy = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query(
        "SELECT setting_value FROM site_settings WHERE setting_key = 'return_policy'",
      );
    const policy = result.recordset[0]?.setting_value || "";
    res.json({ policy });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// تحديث سياسة المرتجع
const updateReturnPolicy = async (req, res) => {
  try {
    const { policy } = req.body;
    if (policy === undefined)
      return res.status(400).json({ error: "Policy content is required" });
    const pool = await poolPromise;
    await pool
      .request()
      .input("key", "return_policy")
      .input("value", policy)
      .query(
        `UPDATE site_settings SET setting_value = @value, updated_at = GETDATE() WHERE setting_key = @key`,
      );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// جلب سعر الشحن
const getShippingFee = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query(
        "SELECT setting_value FROM site_settings WHERE setting_key = 'shipping_fee'",
      );
    const fee = result.recordset[0]?.setting_value || "0";
    res.json({ fee: Number(fee) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// تحديث سعر الشحن
const updateShippingFee = async (req, res) => {
  try {
    const { fee } = req.body;
    if (fee === undefined || isNaN(fee)) {
      return res.status(400).json({ error: "Valid fee is required" });
    }
    const pool = await poolPromise;
    await pool
      .request()
      .input("key", "shipping_fee")
      .input("value", fee.toString())
      .query(
        `UPDATE site_settings SET setting_value = @value, updated_at = GETDATE() WHERE setting_key = @key`,
      );
    res.json({ success: true, fee });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getSiteSettings,
  updateBackgroundSettings,
  updateWhatsappNumber,
  getShippingFee,
  updateShippingFee,
  updateHeroImageWithFile,
  updateHeroImage,
  getReturnPolicy,
  updateReturnPolicy,
};
