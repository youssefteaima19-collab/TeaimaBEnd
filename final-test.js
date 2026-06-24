const { poolPromise } = require("./config/db");

async function finalCheck() {
  try {
    const pool = await poolPromise;

    // 1. إصدار SQL Server
    const version = await pool.request().query("SELECT @@VERSION AS version");
    console.log(
      "✅ SQL Server version:",
      version.recordset[0].version.split(",")[0],
    );

    // 2. قاعدة البيانات الحالية المتصلة (حسب .env)
    const currentDb = await pool
      .request()
      .query("SELECT DB_NAME() AS current_db");
    console.log("✅ Connected to database:", currentDb.recordset[0].current_db);

    // 3. إنشاء جدول اختبار سريع (يتأكد من صلاحية الكتابة)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='connection_test' AND xtype='U')
      CREATE TABLE connection_test (id INT PRIMARY KEY, message VARCHAR(50))
    `);
    await pool
      .request()
      .query(
        "INSERT INTO connection_test (id, message) VALUES (1, 'Connected successfully')",
      );
    const result = await pool
      .request()
      .query("SELECT message FROM connection_test WHERE id=1");
    console.log("✅ Test query result:", result.recordset[0].message);

    // تنظيف (اختياري)
    await pool.request().query("DROP TABLE connection_test");
    console.log(
      "✅ Full database functionality confirmed. Connection is 100% WORKING.",
    );

    process.exit(0);
  } catch (err) {
    console.error("❌ Final test failed:", err.message);
    process.exit(1);
  }
}

finalCheck();
