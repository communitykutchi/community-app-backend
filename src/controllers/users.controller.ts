import { connectToDatabase } from '../config/db';

export async function getAllUsers() {
  const db = await connectToDatabase();
  const users = await db.collection('users').find().toArray();
  return users;
}