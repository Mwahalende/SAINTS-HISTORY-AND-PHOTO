const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  media: { type: mongoose.Schema.Types.ObjectId, ref: 'Media' },
  userEmail: String,
  text: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Comment', commentSchema);
