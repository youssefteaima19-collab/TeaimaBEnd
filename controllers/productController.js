const { poolPromise } = require("../config/db");
const fs = require("fs");
const path = require("path");

const updateOutOfStockSince = async (pool, productId) => {
  await pool.request().input("productId", productId).query(`
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
};

const sizeOrder = {
  S: 1,
  M: 2,
  L: 3,
  XL: 4,
  "2XL": 5,
  "3XL": 6,
  "4XL": 7,
  "5XL": 8,
  "6XL": 9,
};

const sortSizes = (sizesArray) => {
  if (!Array.isArray(sizesArray)) return [];
  return [...sizesArray].sort(
    (a, b) => (sizeOrder[a.size] || 99) - (sizeOrder[b.size] || 99),
  );
};

const getAllProducts = async (req, res) => {
  try {
    const pool = await poolPromise;
    const products = await pool.request().query(`
      SELECT p.id, p.name, p.description, p.price, p.original_price, p.discount_price AS discount,
             p.sku AS code, p.category_id, c.name AS category_name, p.is_active, p.is_oversize
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1
    `);
    const result = products.recordset;
    for (let product of result) {
      const sizes = await pool
        .request()
        .input("id", product.id)
        .query("SELECT size, stock FROM product_sizes WHERE product_id = @id");
      product.sizes = sortSizes(sizes.recordset);

      const colorsRaw = await pool.request().input("id", product.id).query(`
          SELECT pc.id, pc.name,
            (SELECT ci.image_url FROM color_images ci WHERE ci.color_id = pc.id ORDER BY ci.display_order FOR JSON PATH) AS images_json
          FROM product_colors pc WHERE pc.product_id = @id
        `);
      product.colors = colorsRaw.recordset.map((c) => ({
        id: c.id,
        name: c.name,
        images: c.images_json
          ? JSON.parse(c.images_json).map((img) => img.image_url)
          : [],
      }));

      product.materials = ["قطن"];
      product.oversize = product.is_oversize;
      product.stock = product.sizes.reduce((sum, s) => sum + s.stock, 0);
      product.is_out_of_stock = product.stock === 0;
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    const productRes = await pool
      .request()
      .input("id", id)
      .query(
        "SELECT p.id, p.name, p.description, p.price, p.original_price, p.discount_price AS discount, p.sku AS code, p.category_id, c.name AS category_name, p.is_active, p.is_oversize FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = @id",
      );
    if (productRes.recordset.length === 0)
      return res.status(404).json({ error: "Product not found" });
    const product = productRes.recordset[0];

    const sizes = await pool
      .request()
      .input("id", id)
      .query("SELECT size, stock FROM product_sizes WHERE product_id = @id");
    product.sizes = sortSizes(sizes.recordset);

    const colorsRaw = await pool.request().input("id", id).query(`
        SELECT pc.id, pc.name,
          (SELECT ci.image_url FROM color_images ci WHERE ci.color_id = pc.id ORDER BY ci.display_order FOR JSON PATH) AS images_json
        FROM product_colors pc WHERE pc.product_id = @id
      `);
    product.colors = colorsRaw.recordset.map((c) => ({
      id: c.id,
      name: c.name,
      images: c.images_json
        ? JSON.parse(c.images_json).map((img) => img.image_url)
        : [],
    }));

    product.materials = ["قطن"];
    product.oversize = product.is_oversize;
    product.stock = product.sizes.reduce((sum, s) => sum + s.stock, 0);
    product.is_out_of_stock = product.stock === 0;
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

const createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      original_price,
      discount_price,
      sku,
      category_id,
      is_oversize,
    } = req.body;
    let { sizes, colors } = req.body;
    if (!name || !price)
      return res.status(400).json({ error: "Name and price required" });

    const oversizeValue =
      is_oversize === "true" || is_oversize === true ? 1 : 0;
    if (typeof sizes === "string") sizes = JSON.parse(sizes);
    if (typeof colors === "string") colors = JSON.parse(colors);
    if (!Array.isArray(sizes)) sizes = [];
    if (!Array.isArray(colors)) colors = [];

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("name", name)
      .input("description", description || "")
      .input("price", price)
      .input("original_price", original_price ?? null)
      .input("discount_price", discount_price ?? null)
      .input("sku", sku || null)
      .input("category_id", category_id || null)
      .input("is_oversize", oversizeValue)
      .query(`INSERT INTO products (name, description, price, original_price, discount_price, sku, category_id, is_active, is_oversize)
              VALUES (@name, @description, @price, @original_price, @discount_price, @sku, @category_id, 1, @is_oversize);
              SELECT SCOPE_IDENTITY() AS id;`);
    const productId = result.recordset[0].id;

    // Sizes
    for (const sizeObj of sizes) {
      const size = sizeObj.size,
        stock = sizeObj.stock ?? 1;
      if (size?.trim())
        await pool
          .request()
          .input("product_id", productId)
          .input("size", size.trim())
          .input("stock", stock)
          .query(
            `INSERT INTO product_sizes (product_id, size, stock) VALUES (@product_id, @size, @stock)`,
          );
    }

    // Colors & images
    for (const colorObj of colors) {
      const colorName = colorObj.name;
      let images = colorObj.images;
      if (!images && colorObj.image) images = [colorObj.image];
      if (!images || !Array.isArray(images)) images = [];
      if (!colorName?.trim()) continue;

      const colorInsert = await pool
        .request()
        .input("product_id", productId)
        .input("name", colorName.trim())
        .query(
          `INSERT INTO product_colors (product_id, name) OUTPUT inserted.id VALUES (@product_id, @name)`,
        );
      const colorId = colorInsert.recordset[0].id;

      for (let i = 0; i < images.length; i++) {
        const imgUrl = images[i];
        if (imgUrl?.trim())
          await pool
            .request()
            .input("color_id", colorId)
            .input("image_url", imgUrl.trim())
            .input("display_order", i)
            .query(
              `INSERT INTO color_images (color_id, image_url, display_order) VALUES (@color_id, @image_url, @display_order)`,
            );
      }
    }

    await updateOutOfStockSince(pool, productId);

    res.status(201).json({ id: productId, message: "Product created" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      original_price,
      discount_price,
      sku,
      category_id,
      is_active,
      is_oversize,
    } = req.body;
    let { sizes, colors } = req.body;

    if (!name) return res.status(400).json({ error: "Product name required" });
    const oversizeValue =
      is_oversize === "true" || is_oversize === true ? 1 : 0;
    if (typeof sizes === "string") sizes = JSON.parse(sizes);
    if (typeof colors === "string") colors = JSON.parse(colors);
    if (!Array.isArray(sizes)) sizes = [];
    if (!Array.isArray(colors)) colors = [];

    const pool = await poolPromise;
    await pool
      .request()
      .input("id", id)
      .input("name", name)
      .input("description", description || "")
      .input("price", price)
      .input("original_price", original_price ?? null)
      .input("discount_price", discount_price ?? null)
      .input("sku", sku || null)
      .input("category_id", category_id || null)
      .input("is_active", is_active !== undefined ? is_active : 1)
      .input("is_oversize", oversizeValue)
      .query(`UPDATE products SET name=@name, description=@description, price=@price, original_price=@original_price,
              discount_price=@discount_price, sku=@sku, category_id=@category_id, is_active=@is_active, is_oversize=@is_oversize
              WHERE id=@id`);

    await pool
      .request()
      .input("product_id", id)
      .query("DELETE FROM product_sizes WHERE product_id = @product_id");
    for (const sizeObj of sizes) {
      const size = sizeObj.size,
        stock = sizeObj.stock ?? 1;
      if (size?.trim())
        await pool
          .request()
          .input("product_id", id)
          .input("size", size.trim())
          .input("stock", stock)
          .query(
            `INSERT INTO product_sizes (product_id, size, stock) VALUES (@product_id, @size, @stock)`,
          );
    }

    await pool
      .request()
      .input("product_id", id)
      .query("DELETE FROM product_colors WHERE product_id = @product_id");
    for (const colorObj of colors) {
      const colorName = colorObj.name;
      let images = colorObj.images;
      if (!images && colorObj.image) images = [colorObj.image];
      if (!images || !Array.isArray(images)) images = [];
      if (!colorName?.trim()) continue;

      const colorInsert = await pool
        .request()
        .input("product_id", id)
        .input("name", colorName.trim())
        .query(
          `INSERT INTO product_colors (product_id, name) OUTPUT inserted.id VALUES (@product_id, @name)`,
        );
      const colorId = colorInsert.recordset[0].id;
      for (let i = 0; i < images.length; i++) {
        const imgUrl = images[i];
        if (imgUrl?.trim())
          await pool
            .request()
            .input("color_id", colorId)
            .input("image_url", imgUrl.trim())
            .input("display_order", i)
            .query(
              `INSERT INTO color_images (color_id, image_url, display_order) VALUES (@color_id, @image_url, @display_order)`,
            );
      }
    }

    await updateOutOfStockSince(pool, id);
    res.json({ message: "Product updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const imagesToDelete = await pool.request().input("id", id).query(`
        SELECT ci.image_url 
        FROM color_images ci
        JOIN product_colors pc ON ci.color_id = pc.id
        WHERE pc.product_id = @id
      `);

    await pool
      .request()
      .input("id", id)
      .query("DELETE FROM product_images WHERE product_id = @id");
    await pool
      .request()
      .input("id", id)
      .query("DELETE FROM products WHERE id = @id");

    for (const row of imagesToDelete.recordset) {
      const filePath = path.join(
        __dirname,
        "..",
        "uploads",
        path.basename(row.image_url),
      );
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`✅ Deleted file: ${filePath}`);
      }
    }

    res.json({ message: "Product and associated images deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// controllers/productController.js

// ... الكود الموجود ...

// controllers/productController.js

const getProductStock = async (req, res) => {
  try {
    const { productId } = req.params;
    const pool = await poolPromise;

    // جلب إجمالي المخزون من product_sizes
    const result = await pool.request().input("productId", productId).query(`
        SELECT ISNULL(SUM(stock), 0) AS totalStock
        FROM product_sizes
        WHERE product_id = @productId
      `);

    const stock = result.recordset[0]?.totalStock || 0;

    // (اختياري) التحقق من وجود المنتج نفسه
    const productCheck = await pool
      .request()
      .input("productId", productId)
      .query("SELECT id FROM products WHERE id = @productId AND is_active = 1");
    if (productCheck.recordset.length === 0) {
      return res.status(404).json({ message: "Product not found or inactive" });
    }

    res.json({ stock });
  } catch (error) {
    console.error("Error fetching stock:", error);
    res
      .status(500)
      .json({ message: "خطأ في جلب المخزون", error: error.message });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  getProductStock,
  updateProduct,
  deleteProduct,
};
