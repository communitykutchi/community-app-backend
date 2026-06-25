"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllUsers = getAllUsers;
const db_1 = require("../config/db");
async function getAllUsers() {
    const db = await (0, db_1.connectToDatabase)();
    const users = await db.collection('users').find().toArray();
    return users;
}
