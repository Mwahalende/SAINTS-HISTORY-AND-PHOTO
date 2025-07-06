const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: String,
  googleId: String,
  profilePhoto: String
});

module.exports = mongoose.model('Admin', adminSchema);
