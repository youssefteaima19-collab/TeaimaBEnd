const { poolPromise } = require("../config/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");   // تأكد من تثبيت bcryptjs

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("email", email)
      .query("SELECT * FROM users WHERE email = @email");
    const user = result.recordset[0];
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    // مقارنة كلمة المرور المدخلة مع الهاش المخزن
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const pool = await poolPromise;

    // التحقق من وجود البريد مسبقًا
    const existing = await pool
      .request()
      .input("email", email)
      .query("SELECT id FROM users WHERE email = @email");
    if (existing.recordset.length > 0) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // تشفير كلمة المرور
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await pool
      .request()
      .input("name", name)
      .input("email", email)
      .input("password", hashedPassword)
      .query(
        "INSERT INTO users (name, email, password, role) VALUES (@name, @email, @password, 'customer')"
      );
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { login, register };