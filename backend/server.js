require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const connectDB  = require('./config/db');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', credentials: true },
  transports: ['websocket', 'polling'],
});

app.set('io', io);
connectDB();

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 30 });
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/api/auth',            authLimiter, require('./routes/auth'));
app.use('/api/stocks',          require('./routes/stocks'));
app.use('/api/recommendations', require('./routes/recommendations'));
app.use('/api/users',           require('./routes/users'));
app.use('/api/notifications',   require('./routes/notifications'));
app.get('/api/health', (_, res) => res.json({ status:'ok', time:new Date() }));

// ── Socket.io ──────────────────────────────────────────────────────
// userId (string) -> socketId (string)  — simple 1:1 map
const userSocketMap = new Map();

io.on('connection', (socket) => {
  console.log('🔌 Connected:', socket.id);

  socket.on('auth', (userId) => {
    const uid = String(userId).trim();
    if (!uid || uid === 'undefined' || uid === 'null') {
      console.log('⚠️  Auth received invalid userId:', userId);
      return;
    }
    userSocketMap.set(uid, socket.id);
    socket.uid = uid;
    console.log(`✅ User ${uid} mapped to socket ${socket.id}`);
    console.log(`   Total connected users: ${userSocketMap.size}`);
  });

  socket.on('disconnect', () => {
    if (socket.uid) {
      userSocketMap.delete(socket.uid);
      console.log(`🔌 User ${socket.uid} disconnected`);
    }
  });
});

// Save notification to DB and emit to socket if online
const Notification = require('./models/Notification');
io.notifyUser = async (userId, event, data) => {
  const uid      = String(userId).trim();
  const socketId = userSocketMap.get(uid);
  console.log(`📨 notifyUser → uid="${uid}", socketId="${socketId||'NOT FOUND'}"`);

  // Always save to DB (persistent)
  try {
    await Notification.create({
      user:  uid,
      type:  data.type  || 'new_rec',
      title: data.title || '',
      body:  data.body  || '',
      recId: data.recId || null,
    });
  } catch(e) { console.log('Notification save error:', e.message); }

  // Emit to socket if online
  if (socketId) {
    io.to(socketId).emit(event, data);
    console.log(`   ✅ Sent "${event}" to socket ${socketId}`);
  } else {
    console.log(`   ℹ️  User ${uid} offline — saved to DB`);
  }
};

app.get('*', (_, res) =>
  res.sendFile(path.join(__dirname, '../frontend/index.html'))
);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 SwingRush on http://localhost:${PORT}`));
