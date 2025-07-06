const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  name: String,
  description: String,
  type: String, // photo, video, audio
  url: String,
  likes: { type: Number, default: 0 },
  dislikes: { type: Number, default: 0 },
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  createdAt: { type: Date, default: Date.now } // ✅ capture upload date
});

module.exports = mongoose.model('Media', mediaSchema);
