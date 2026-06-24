const jwt = require("jsonwebtoken");

// توليد JWT token
exports.generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// يمكن إضافة دوال أخرى مثل slugify، تنسيق التواريخ، إلخ.
