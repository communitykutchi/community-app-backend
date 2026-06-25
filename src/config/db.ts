import mongoose from 'mongoose';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);
let connected = false;

const connectDB = async (uri: string) => {
  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

export async function connectToDatabase() {
  if (!connected) {
    await client.connect();
    connected = true;
  }
  return client.db('community'); // Replace 'community' with your database name
}

export default connectDB;
