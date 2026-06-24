const jwt = require("jsonwebtoken");
const { poolPromise } = require("../config/db");
const { upload } = require("../server"); // استيراد upload من server.js

exports.protect = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) {
    req.user = null; // يسمح للزوار
    return next();
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", decoded.id)
      .query("SELECT id, name, email, role FROM users WHERE id = @id");
    if (!result.recordset[0]) {
      req.user = null;
    } else {
      req.user = result.recordset[0];
    }
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

exports.admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Not authorized as admin" });
  }
};
