import express from "express";
import authMiddleware from "../middlewares/auth.middleware";
import {
  getFriends,
  searchUsers,
  sendFriendRequest,
  cancelFriendRequest,
  unfriend,
  getIncomingRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  getUserChats,
  getOrCreateChat,
  getChatMessages,
  sendMessage,
  getUnreadChatCount,
  markChatAsRead,
  deleteMessage,
} from "../controllers/friends.controller";

const router = express.Router();

router.use(authMiddleware);

router.get("/search", searchUsers);
router.get("/me", getFriends);
router.get("/requests/incoming", getIncomingRequests);
router.get("/unread-chat-count", getUnreadChatCount);
router.post("/request/:friendId", sendFriendRequest);
router.post("/request/:friendId/cancel", cancelFriendRequest);
router.post("/unfriend/:friendId", unfriend);
router.post("/add/:friendId", sendFriendRequest);
router.post("/request/:requesterId/accept", acceptFriendRequest);
router.post("/request/:requesterId/reject", rejectFriendRequest);
router.get("/chats", getUserChats);
router.post("/chats/:friendId/read", markChatAsRead);
router.get("/chats/:friendId", getOrCreateChat);
router.get("/chats/:chatId/messages", getChatMessages);
router.post("/chats/:chatId/messages", sendMessage);
router.delete("/chats/:chatId/messages/:messageId", deleteMessage);

export default router;
