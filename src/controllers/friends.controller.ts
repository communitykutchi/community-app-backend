import { Request, Response } from "express";
import mongoose from "mongoose";
import User from "../models/User";
import Chat from "../models/Chat";
import { AuthRequest } from "../middlewares/auth.middleware";

const toObjectId = (value: string) => {
  if (!mongoose.isObjectIdOrHexString(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

const buildUserSearchQuery = (query: string, userId: string | undefined) => {
  const regex = new RegExp(query, "i");
  return {
    $and: [
      { _id: { $ne: userId } },
      {
        $or: [
          { fullName: regex },
          { username: regex },
          { email: regex },
          { mobile: regex },
        ],
      },
    ],
  };
};

export const searchUsers = async (req: AuthRequest, res: Response) => {
  try {
    const query = String(req.query.q || "").trim();
    if (!query) {
      return res.status(400).json({ success: false, message: "Search query is required" });
    }

    const regex = new RegExp(query, "i");
    const users = await User.find({
      $and: [
        { _id: { $ne: req.userId } },
        {
          $or: [
            { fullName: regex },
            { username: regex },
            { email: regex },
            { mobile: regex },
          ],
        },
      ],
    })
      .select("fullName username email mobile profilePhotoUrl isOnline lastActive")
      .limit(20);

    return res.json({ success: true, users });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to search users" });
  }
};

export const getFriends = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const user = await User.findById(req.userId)
      .populate("friends", "fullName username email mobile profilePhotoUrl isOnline lastActive")
      .populate("friendRequestsReceived", "fullName username email mobile profilePhotoUrl isOnline lastActive")
      .populate("friendRequestsSent", "fullName username email mobile profilePhotoUrl isOnline lastActive");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({
      success: true,
      friends: user.friends || [],
      incomingRequests: user.friendRequestsReceived || [],
      sentRequests: user.friendRequestsSent || [],
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to load friends" });
  }
};

export const getIncomingRequests = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const user = await User.findById(req.userId).populate("friendRequestsReceived", "fullName username email mobile profilePhotoUrl isOnline lastActive");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, requests: user.friendRequestsReceived || [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to load friend requests" });
  }
};

export const sendFriendRequest = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const friendId = req.params.friendId;
    const friendObjectId = toObjectId(friendId);
    if (!friendObjectId) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }

    if (String(friendObjectId) === String(req.userId)) {
      return res.status(400).json({ success: false, message: "Cannot send a request to yourself" });
    }

    const user = await User.findById(req.userId);
    const friend = await User.findById(friendObjectId);

    if (!user || !friend) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.friends?.some((id) => String(id) === String(friendObjectId))) {
      return res.status(400).json({ success: false, message: "Already friends" });
    }

    if (user.friendRequestsSent?.some((id) => String(id) === String(friendObjectId))) {
      return res.status(400).json({ success: false, message: "Friend request already sent" });
    }

    if (user.friendRequestsReceived?.some((id) => String(id) === String(friendObjectId))) {
      return res.status(400).json({ success: false, message: "This user has already sent you a request" });
    }

    user.friendRequestsSent = [...(user.friendRequestsSent || []), friendObjectId];
    friend.friendRequestsReceived = [...(friend.friendRequestsReceived || []), new mongoose.Types.ObjectId(req.userId)];

    await user.save();
    await friend.save();

    return res.json({ success: true, message: "Friend request sent" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to send friend request" });
  }
};

export const cancelFriendRequest = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const friendId = req.params.friendId;
    const friendObjectId = toObjectId(friendId);
    if (!friendObjectId) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }

    const user = await User.findById(req.userId);
    const friend = await User.findById(friendObjectId);

    if (!user || !friend) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.friendRequestsSent?.some((id) => String(id) === String(friendObjectId))) {
      return res.status(400).json({ success: false, message: "No outgoing friend request to cancel" });
    }

    user.friendRequestsSent = (user.friendRequestsSent || []).filter((id) => String(id) !== String(friendObjectId));
    friend.friendRequestsReceived = (friend.friendRequestsReceived || []).filter((id) => String(id) !== String(req.userId));

    await user.save();
    await friend.save();

    return res.json({ success: true, message: "Friend request canceled" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to cancel friend request" });
  }
};

export const unfriend = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const friendId = req.params.friendId;
    const friendObjectId = toObjectId(friendId);
    if (!friendObjectId) {
      return res.status(400).json({ success: false, message: "Invalid friend id" });
    }

    const user = await User.findById(req.userId);
    const friend = await User.findById(friendObjectId);

    if (!user || !friend) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.friends?.some((id) => String(id) === String(friendObjectId))) {
      return res.status(400).json({ success: false, message: "Not friends" });
    }

    user.friends = (user.friends || []).filter((id) => String(id) !== String(friendObjectId));
    friend.friends = (friend.friends || []).filter((id) => String(id) !== String(req.userId));

    await user.save();
    await friend.save();

    return res.json({ success: true, message: "Unfriended successfully" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to unfriend" });
  }
};

export const acceptFriendRequest = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const requesterId = req.params.requesterId;
    const requesterObjectId = toObjectId(requesterId);
    if (!requesterObjectId) {
      return res.status(400).json({ success: false, message: "Invalid requester id" });
    }

    const user = await User.findById(req.userId);
    const requester = await User.findById(requesterObjectId);

    if (!user || !requester) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.friendRequestsReceived?.some((id) => String(id) === String(requesterObjectId))) {
      return res.status(400).json({ success: false, message: "No friend request from this user" });
    }

    user.friendRequestsReceived = (user.friendRequestsReceived || []).filter((id) => String(id) !== String(requesterObjectId));
    requester.friendRequestsSent = (requester.friendRequestsSent || []).filter((id) => String(id) !== String(req.userId));

    user.friends = [...(user.friends || []), requesterObjectId];
    requester.friends = [...(requester.friends || []), new mongoose.Types.ObjectId(req.userId)];

    await user.save();
    await requester.save();

    return res.json({ success: true, message: "Friend request accepted" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to accept friend request" });
  }
};

export const rejectFriendRequest = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const requesterId = req.params.requesterId;
    const requesterObjectId = toObjectId(requesterId);
    if (!requesterObjectId) {
      return res.status(400).json({ success: false, message: "Invalid requester id" });
    }

    const user = await User.findById(req.userId);
    const requester = await User.findById(requesterObjectId);

    if (!user || !requester) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.friendRequestsReceived?.some((id) => String(id) === String(requesterObjectId))) {
      return res.status(400).json({ success: false, message: "No friend request from this user" });
    }

    user.friendRequestsReceived = (user.friendRequestsReceived || []).filter((id) => String(id) !== String(requesterObjectId));
    requester.friendRequestsSent = (requester.friendRequestsSent || []).filter((id) => String(id) !== String(req.userId));

    await user.save();
    await requester.save();

    return res.json({ success: true, message: "Friend request rejected" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to reject friend request" });
  }
};

export const getUserChats = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const chats = await Chat.find({
      participants: req.userId,
    })
      .populate("participants", "fullName username email mobile profilePhotoUrl isOnline lastActive")
      .populate("messages.sender", "fullName username email profilePhotoUrl")
      .sort({ updatedAt: -1 });

    // Mark messages sent to current user as delivered, but do not mark them read yet.
    for (const chat of chats) {
      let modified = false;
      chat.messages.forEach((msg: any) => {
        const senderId = msg.sender?._id ? String(msg.sender._id) : String(msg.sender);
        if (senderId !== String(req.userId) && !msg.isDelivered) {
          msg.isDelivered = true;
          modified = true;
        }
      });
      if (modified) {
        await chat.save();
      }
    }

    return res.json({ success: true, chats });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to load chats" });
  }
};

export const getOrCreateChat = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const friendId = req.params.friendId;
    const friendObjectId = toObjectId(friendId);
    if (!friendObjectId) {
      return res.status(400).json({ success: false, message: "Invalid friend id" });
    }

    const participantIds = [new mongoose.Types.ObjectId(req.userId), friendObjectId];
    const chat = await Chat.findOne({
      participants: { $all: participantIds, $size: 2 },
    })
      .populate("participants", "fullName username email mobile profilePhotoUrl isOnline lastActive")
      .populate("messages.sender", "fullName username email profilePhotoUrl");

    if (chat) {
      // Only mark messages received by req.userId as delivered. Read state is set when the chat is actually viewed by the user.
      let modified = false;
      chat.messages.forEach((msg: any) => {
        const senderId = msg.sender?._id ? String(msg.sender._id) : String(msg.sender);
        if (senderId !== String(req.userId)) {
          if (!msg.isDelivered) {
            msg.isDelivered = true;
            modified = true;
          }
        }
      });
      if (modified) {
        await chat.save();
      }
      return res.json({ success: true, chat });
    }

    const newChat = await Chat.create({ participants: participantIds, messages: [] });
    await newChat.populate("participants", "fullName username email mobile profilePhotoUrl isOnline lastActive");

    return res.json({ success: true, chat: newChat });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to open chat" });
  }
};

export const getChatMessages = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const chatId = req.params.chatId;
    if (!mongoose.isObjectIdOrHexString(chatId)) {
      return res.status(400).json({ success: false, message: "Invalid chat id" });
    }

    const chat = await Chat.findById(chatId).populate("messages.sender", "fullName username email profilePhotoUrl");
    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }

    const isParticipant = chat.participants.some((participant) => String(participant) === String(req.userId));
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    let modified = false;
    chat.messages.forEach((msg: any) => {
      const senderId = msg.sender?._id ? String(msg.sender._id) : String(msg.sender);
      if (senderId !== String(req.userId)) {
        if (!msg.isDelivered || !msg.isRead) {
          msg.isDelivered = true;
          msg.isRead = true;
          modified = true;
        }
      }
    });
    if (modified) {
      await chat.save();
    }

    return res.json({ success: true, messages: chat.messages || [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to load messages" });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const chatId = req.params.chatId;
    const { text } = req.body;

    if (!mongoose.isObjectIdOrHexString(chatId)) {
      return res.status(400).json({ success: false, message: "Invalid chat id" });
    }

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ success: false, message: "Message text is required" });
    }

    const chat = await Chat.findById(chatId).populate("participants", "isOnline lastActive");
    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }

    const isParticipant = chat.participants.some((participant: any) => String(participant._id || participant) === String(req.userId));
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const partner = chat.participants.find((p: any) => String(p._id || p) !== String(req.userId));

    chat.messages.push({
      sender: new mongoose.Types.ObjectId(req.userId),
      text: text.trim(),
      isDelivered: false,
      isRead: false,
      createdAt: new Date(),
    } as any);

    await chat.save();

    await chat.populate("participants", "fullName username email mobile profilePhotoUrl isOnline lastActive");
    await chat.populate("messages.sender", "fullName username email profilePhotoUrl");

    return res.status(201).json({ success: true, message: "Message sent", chat });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to send message" });
  }
};
