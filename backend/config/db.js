const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/swingrush';
    const conn = await mongoose.connect(mongoUri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️  Continuing without MongoDB in development mode');
      return;
    }
    process.exit(1);
  }
};

module.exports = connectDB;
