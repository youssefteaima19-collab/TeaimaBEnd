const { poolPromise } = require("../config/db");

const getAllCategories = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT id, name, slug, description, is_active
      FROM categories
      WHERE is_active = 1
      ORDER BY name
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getAllCategories };
