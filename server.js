
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const passport = require('passport');
const session = require('express-session');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');

const app = express();
const PORT = 3000;
const JWT_SECRET = '12345678';

// MongoDB
mongoose.connect('mongodb+srv://user1:malafiki@leodb.5mf7q.mongodb.net/?retryWrites=true&w=majority&appName=leodb')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Cloudinary config
cloudinary.config({
  cloud_name: 'drxvftof4',
  api_key: '872961783425164',
  api_secret: 'KWEJ6SbPybty7YefACspZ-j-ym0'
});
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: 'media_uploads',
    resource_type: 'auto',
  }),
});
const upload = multer({ storage });

// Passport session
app.use(session({ secret: 'secret123', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

// Models
const Admin = require('./models/Admin');
const Media = require('./models/Media');
const User = require('./models/User');
const Comment = require('./models/Comment');

// Google OAuth
passport.use(new GoogleStrategy({
  clientID: '199468518160-0ubjlcvm41a5gk0ud78fkpfuu5kn0v7a.apps.googleusercontent.com',
  clientSecret: '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',
  callbackURL: '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  let admin = await Admin.findOne({ googleId: profile.id });
  if (!admin) {
    admin = await Admin.create({
      googleId: profile.id,
      email: profile.emails[0].value,
      profilePhoto: profile.photos[0].value
    });
  }
  return done(null, admin);
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  const admin = await Admin.findById(id);
  done(null, admin);
});

// Email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'zumalipas@gmail.com',
    pass: 'xsds bimk ndlb vmrr'
  }
});

// ===== ROUTES =====

// Register
app.post('/register', async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body;
    if (!email || !password || !confirmPassword) return res.status(400).send('All fields required');
    if (password !== confirmPassword) return res.status(400).send('Passwords do not match');

    const exists = await Admin.findOne({ email });
    if (exists) return res.status(400).send('Email already registered');

    const hashed = await bcrypt.hash(password, 10);
    await Admin.create({ email, password: hashed });

    res.status(201).send('Admin registered');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error');
  }
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const admin = await Admin.findOne({ email });
  if (!admin || !(await bcrypt.compare(password, admin.password))) return res.status(401).send('Invalid');

  const token = jwt.sign({
    id: admin._id,
    email: admin.email,
    photo: admin.profilePhoto || null
  }, JWT_SECRET);

  res.json({ token });
});

// Google login
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', {
  failureRedirect: '/login.html'
}), (req, res) => {
  const token = jwt.sign({
    id: req.user._id,
    email: req.user.email,
    photo: req.user.profilePhoto || null
  }, JWT_SECRET);
  res.redirect(`/admin.html?token=${token}`);
});

// Upload media
app.post('/upload', upload.single('file'), async (req, res) => {
  const { name, description, adminId, type } = req.body;
  const media = await Media.create({
    name,
    description,
    type,
    url: req.file.path,
    admin: adminId
  });

  const users = await User.find({ subscribed: true });
  users.forEach(user => {
    transporter.sendMail({
      from: 'zumalipas@gmail.com',
      to: user.email,
      subject: `New ${type} Uploaded`,
      html: `<p>${name}: ${description}</p><a href="http://localhost:3000/media.html">View</a>`
    });
  });

  res.json(media);
});

// Media listing
app.get('/media', async (req, res) => {
  const { name, date } = req.query;
  const filter = {};
  if (name) filter.name = { $regex: name, $options: 'i' };
  if (date) {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    filter.createdAt = { $gte: start, $lt: end };
  }
  const media = await Media.find(filter).populate('comments').sort({ createdAt: -1 });
  res.json(media);
});


// Delete media
app.delete('/media/:id', async (req, res) => {
  await Media.findByIdAndDelete(req.params.id);
  res.sendStatus(204);
});

// Like / Dislike
app.post('/like/:id', async (req, res) => {
  const media = await Media.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } }, { new: true });
  res.json(media);
});
app.post('/dislike/:id', async (req, res) => {
  const media = await Media.findByIdAndUpdate(req.params.id, { $inc: { dislikes: 1 } }, { new: true });
  res.json(media);
});

// Comment
app.post('/comment/:mediaId', async (req, res) => {
  const { text, email } = req.body;
  const comment = await Comment.create({ text, userEmail: email, media: req.params.mediaId });
  await Media.findByIdAndUpdate(req.params.mediaId, { $push: { comments: comment._id } });
  res.json(comment);
});

// Register user
app.post('/register-user', async (req, res) => {
  const { email } = req.body;
  const exists = await User.findOne({ email });
  if (exists) return res.status(400).send('Already registered');
  const user = await User.create({ email });
  res.json(user);
});

// Unsubscribe
app.post('/unsubscribe', async (req, res) => {
  await User.findOneAndUpdate({ email: req.body.email }, { subscribed: false });
  res.send('Unsubscribed');
});

// Upload profile photo
app.post('/upload-profile/:adminId', upload.single('photo'), async (req, res) => {
  try {
    const admin = await Admin.findByIdAndUpdate(
      req.params.adminId,
      { profilePhoto: req.file.path },
      { new: true }
    );
    res.json({ message: 'Profile updated', photo: admin.profilePhoto });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating profile');
  }
});
// Get admin photo
app.get('/admin/profile-photo/:id', async (req, res) => {
  const admin = await Admin.findById(req.params.id);
  res.json({ photo: admin.profilePhoto || null });
});

// Get subscriber count
app.get('/subscribers-count/:mediaId', async (req, res) => {
  try {
    const count = await User.countDocuments({ subscribed: true });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to count subscribers' });
  }
});
app.put('/media/:id', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !description) return res.status(400).json({ error: 'Name and description are required.' });

    const updated = await Media.findByIdAndUpdate(
      req.params.id,
      { name, description },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Media not found.' });

    res.status(200).json(updated);
  } catch (err) {
    console.error('Error updating media:', err);
    res.status(500).json({ error: 'Server error while updating media.' });
  }
});


// Server start
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

