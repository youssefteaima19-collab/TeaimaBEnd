const sql = require("mssql");
require("dotenv").config();

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

const poolPromise = new sql.ConnectionPool(dbConfig)
  .connect()
  .then((pool) => {
    console.log("✅ SQL Server connected successfully");
    return pool;
  })
  .catch((err) => {
    console.error("❌ SQL Server connection error:", err.message);
    process.exit(1);
  });

const connectDB = async () => {
  try {
    const pool = await poolPromise;
    console.log("✅ Database connected and ready");
    return pool;
  } catch (error) {
    console.error("❌ SQL Server connection error:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
module.exports.sql = sql;
module.exports.poolPromise = poolPromise;
