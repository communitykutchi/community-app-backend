"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectToDatabase = connectToDatabase;
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_1 = require("mongodb");
const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
const client = new mongodb_1.MongoClient(uri);
let connected = false;
const connectDB = async (uri) => {
    try {
        await mongoose_1.default.connect(uri);
        console.log('MongoDB connected');
    }
    catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
};
async function connectToDatabase() {
    if (!connected) {
        await client.connect();
        connected = true;
    }
    return client.db('community'); // Replace 'community' with your database name
}
exports.default = connectDB;
