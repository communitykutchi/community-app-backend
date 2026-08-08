import { Request, Response } from "express";
import mongoose from "mongoose";
import User from "../models/User";
import Chat from "../models/Chat";
import { AuthRequest } from "../middlewares/auth.middleware";
import { sendPushNotificationToUser } from "../services/pushNotification.service";

const toObjectId = (value: string) => {
  if (!mongoose.isObjectIdOrHexString(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

const buildUserSearchQuery = (query: string, userId: string | undefined) => {
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escapedQuery, "i");
  return {
    $and: [
      { _id: { $ne: userId } },
      { role: { $ne: "super_admin" } },
      { username: { $ne: "superadmin" } },
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

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escapedQuery, "i");

    const isEmailSearch = query.includes("@");
    const isNumberSearch = /^\+?\d+$/.test(query);

    const searchConditions: any[] = [
      { fullName: regex },
      { username: regex },
    ];

    if (isEmailSearch) {
      searchConditions.push({ email: regex });
    }
    if (isNumberSearch) {
      searchConditions.push({ mobile: regex });
    }

    const rawUsers = await User.find({
      $and: [
        { _id: { $ne: req.userId } },
        { role: { $ne: "super_admin" } },
        { username: { $ne: "superadmin" } },
        { $or: searchConditions },
      ],
    })
      .select("fullName username email mobile profilePhotoUrl isOnline lastActive")
      .lean();

    const lowerQ = query.toLowerCase();
    const sortedUsers = rawUsers.sort((a: any, b: any) => {
      const aName = String(a.fullName || "").toLowerCase();
      const bName = String(b.fullName || "").toLowerCase();
      const aUser = String(a.username || "").toLowerCase();
      const bUser = String(b.username || "").toLowerCase();

      const aStartsWith = aName.startsWith(lowerQ) || aUser.startsWith(lowerQ);
      const bStartsWith = bName.startsWith(lowerQ) || bUser.startsWith(lowerQ);

      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;

      return aName.localeCompare(bName);
    });

    return res.json({ success: true, users: sortedUsers.slice(0, 25) });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to search users" });
  }
};

const formatUserPresence = (doc: any) => {
  if (!doc) return doc;
  const user = doc.toObject ? doc.toObject() : doc;
  const lastActiveTime = user.lastActive ? new Date(user.lastActive).getTime() : 0;
  const isOnline = Boolean(user.isOnline) && Date.now() - lastActiveTime < 30000;
  return { ...user, isOnline };
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

    const friendsWithUnread = await Promise.all(
      (user.friends || []).map(async (friendDoc: any) => {
        const f = formatUserPresence(friendDoc);
        const chat = await Chat.findOne({
          participants: { $all: [user._id, friendDoc._id], $size: 2 },
        }).select("messages").lean();
        let unreadCount = 0;
        if (chat && chat.messages) {
          chat.messages.forEach((msg: any) => {
            const senderId = msg.sender ? String(msg.sender) : "";
            if (senderId !== String(user._id) && !msg.isRead) {
              unreadCount += 1;
            }
          });
        }
        return { ...f, unreadCount };
      })
    );
    const incomingRequests = (user.friendRequestsReceived || []).map(formatUserPresence);
    const sentRequests = (user.friendRequestsSent || []).map(formatUserPresence);

    return res.json({
      success: true,
      friends: friendsWithUnread,
      incomingRequests,
      sentRequests,
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

    await sendPushNotificationToUser(
      String(friend._id),
      "🤝 New Friend Request",
      `${user.fullName || "A community member"} sent you a friend request.`,
      { targetTab: "friends", senderId: String(user._id) }
    );

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

    await sendPushNotificationToUser(
      String(requester._id),
      "🤝 Friend Request Accepted",
      `${user.fullName || "A community member"} accepted your friend request.`,
      { targetTab: "friends", senderId: String(user._id) }
    );

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

    const formattedChats = chats.map((c: any) => {
      const chatObj = c.toObject ? c.toObject() : { ...c };
      chatObj.participants = (chatObj.participants || []).map(formatUserPresence);
      let unreadCount = 0;
      (chatObj.messages || []).forEach((m: any) => {
        const senderId = m.sender?._id ? String(m.sender._id) : String(m.sender);
        if (senderId !== String(req.userId) && !m.isRead) {
          unreadCount += 1;
        }
      });
      (chatObj as any).unreadCount = unreadCount;
      return chatObj;
    });

    return res.json({ success: true, chats: formattedChats });
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
      // Mark messages received by req.userId as delivered and read when opening the chat room.
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
      const chatObj = chat.toObject ? chat.toObject() : chat;
      chatObj.participants = (chatObj.participants || []).map(formatUserPresence);
      chatObj.messages = (chatObj.messages || []).filter((m: any) => {
        const deletedFor = (m.deletedFor || []).map((id: any) => String(id._id || id));
        return !deletedFor.includes(String(req.userId));
      });
      return res.json({ success: true, chat: chatObj });
    }

    const newChat = await Chat.create({ participants: participantIds, messages: [] });
    await newChat.populate("participants", "fullName username email mobile profilePhotoUrl isOnline lastActive");

    const newChatObj = newChat.toObject ? newChat.toObject() : newChat;
    newChatObj.participants = (newChatObj.participants || []).map(formatUserPresence);
    return res.json({ success: true, chat: newChatObj });
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

    const filteredMessages = (chat.messages || []).filter((m: any) => {
      const deletedFor = (m.deletedFor || []).map((id: any) => String(id._id || id));
      return !deletedFor.includes(String(req.userId));
    });

    return res.json({ success: true, messages: filteredMessages });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to load messages" });
  }
};

export const getUnreadChatCount = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.json({ success: true, unreadCount: 0, totalUnreadMessages: 0 });
    }

    const chats = await Chat.find({ participants: req.userId })
      .populate("participants", "fullName username profilePhotoUrl")
      .populate("messages.sender", "fullName username profilePhotoUrl")
      .lean();

    let unreadChatsCount = 0;
    let totalUnreadMessages = 0;
    let latestUnreadMsg: any = null;
    let latestUnreadTime = 0;

    for (const chat of chats) {
      const unreadMsgs = (chat.messages || []).filter((msg: any) => {
        const senderId = msg.sender?._id ? String(msg.sender._id) : String(msg.sender || "");
        return senderId !== String(req.userId) && !msg.isRead;
      });

      if (unreadMsgs.length > 0) {
        unreadChatsCount += 1;
        totalUnreadMessages += unreadMsgs.length;
        const lastUnread = unreadMsgs[unreadMsgs.length - 1];
        const msgTime = new Date(lastUnread.createdAt || Date.now()).getTime();
        if (msgTime > latestUnreadTime) {
          latestUnreadTime = msgTime;
          const senderObj: any = typeof lastUnread.sender === "object" ? lastUnread.sender : null;
          const senderName = senderObj?.fullName || senderObj?.username || "Community Friend";
          const senderId = senderObj?._id ? String(senderObj._id) : String(lastUnread.sender || "");
          const msgId = String((lastUnread as any)._id || (lastUnread as any).id || `${senderId}-${msgTime}`);


          latestUnreadMsg = {
            id: msgId,
            senderName,
            text: lastUnread.text || "",
            senderId,
            chatId: String(chat._id),
          };
        }
      }
    }

    return res.json({
      success: true,
      unreadCount: unreadChatsCount,
      totalUnreadMessages,
      latestUnreadMessage: latestUnreadMsg,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to count unread chats" });
  }
};

export const markChatAsRead = async (req: AuthRequest, res: Response) => {
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
    });

    if (chat) {
      let modified = false;
      chat.messages.forEach((msg: any) => {
        const senderId = msg.sender?._id ? String(msg.sender._id) : String(msg.sender);
        if (senderId !== String(req.userId) && !msg.isRead) {
          msg.isDelivered = true;
          msg.isRead = true;
          modified = true;
        }
      });
      if (modified) {
        await chat.save();
      }
    }

    return res.json({ success: true, message: "Chat marked as read" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to mark chat read" });
  }
};

export const markChatAsDelivered = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const { chatId, senderId } = req.body || {};
    const targetUserId = req.userId;

    if (chatId && mongoose.isObjectIdOrHexString(chatId)) {
      await Chat.updateOne(
        { _id: chatId },
        { $set: { "messages.$[elem].isDelivered": true } },
        { arrayFilters: [{ "elem.sender": { $ne: targetUserId }, "elem.isDelivered": false }] }
      ).catch(() => {});
    } else {
      await Chat.updateMany(
        { participants: targetUserId, "messages.sender": { $ne: targetUserId }, "messages.isDelivered": false },
        { $set: { "messages.$[elem].isDelivered": true } },
        { arrayFilters: [{ "elem.sender": { $ne: targetUserId }, "elem.isDelivered": false }] }
      ).catch(() => {});
    }

    return res.json({ success: true, message: "Messages marked as delivered" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to mark chat delivered" });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const chatId = req.params.chatId;
    const { text, replyTo, audioUrl, audioDuration, mediaUrl, mediaType } = req.body;

    if (!mongoose.isObjectIdOrHexString(chatId)) {
      return res.status(400).json({ success: false, message: "Invalid chat id" });
    }

    const hasText = text && typeof text === "string" && text.trim().length > 0;
    const hasAudio = Boolean(audioUrl && String(audioUrl).trim());
    const hasMedia = Boolean(mediaUrl && String(mediaUrl).trim());

    if (!hasText && !hasAudio && !hasMedia) {
      return res.status(400).json({ success: false, message: "Message content (text, voice note, or media) is required" });
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
    const partnerUser = partner ? await User.findById((partner as any)._id || partner).select("isOnline lastActive").lean() : null;
    const lastActiveTime = partnerUser?.lastActive ? new Date(partnerUser.lastActive).getTime() : 0;
    const isPartnerOnline = Boolean(partnerUser?.isOnline) && Date.now() - lastActiveTime < 30000;

    const messageText = hasText ? String(text).trim() : hasAudio ? "🎙️ Voice Message" : "📷 Media Attachment";

    // Update sender's lastActive timestamp and presence in database
    await User.findByIdAndUpdate(req.userId, {
      $set: { isOnline: true, lastActive: new Date() },
    }).catch(() => {});

    chat.messages.push({
      sender: new mongoose.Types.ObjectId(req.userId),
      text: messageText,
      audioUrl: hasAudio ? String(audioUrl).trim() : undefined,
      audioDuration: hasAudio && typeof audioDuration === "number" ? audioDuration : undefined,
      mediaUrl: hasMedia ? String(mediaUrl).trim() : undefined,
      mediaType: hasMedia && mediaType ? mediaType : hasAudio ? "audio" : undefined,
      replyTo: replyTo && typeof replyTo === "object" ? {
        _id: String(replyTo._id || ""),
        text: String(replyTo.text || ""),
        senderName: String(replyTo.senderName || ""),
      } : undefined,
      isDelivered: isPartnerOnline,
      isRead: false,
      createdAt: new Date(),
    } as any);

    await chat.save();

    await chat.populate("participants", "fullName username email mobile profilePhotoUrl isOnline lastActive");
    await chat.populate("messages.sender", "fullName username email profilePhotoUrl");

    // Send push notification to recipient partner when app is closed / background
    if (partner) {
      const recipientId = String((partner as any)._id || partner);
      const senderUser = await User.findById(req.userId).select("fullName username").lean();
      const senderName = senderUser?.fullName || senderUser?.username || "Community Friend";
      await sendPushNotificationToUser(
        recipientId,
        `💬 ${senderName}`,
        messageText,
        {
          targetTab: "chat",
          targetId: String(req.userId),
          chatId: String(chat._id),
          senderId: String(req.userId),
        }
      );
    }

    const chatObj = chat.toObject ? chat.toObject() : chat;
    chatObj.messages = (chatObj.messages || []).filter((m: any) => {
      const deletedFor = (m.deletedFor || []).map((id: any) => String(id._id || id));
      return !deletedFor.includes(String(req.userId));
    });

    return res.status(201).json({ success: true, message: "Message sent", chat: chatObj });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to send message" });
  }
};

export const deleteMessage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const { chatId, messageId } = req.params;
    const { deleteType } = req.body || {}; // "me" | "everyone"

    if (!mongoose.isObjectIdOrHexString(chatId) || !mongoose.isObjectIdOrHexString(messageId)) {
      return res.status(400).json({ success: false, message: "Invalid parameters" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }

    const isParticipant = chat.participants.some(
      (p: any) => String(p._id || p) === String(req.userId)
    );
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const message = chat.messages.find(
      (m: any) => String(m._id || m.id) === String(messageId)
    );
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    const senderId = message.sender?._id ? String(message.sender._id) : String(message.sender);
    const isSender = senderId === String(req.userId);

    if (deleteType === "everyone") {
      if (!isSender) {
        return res.status(403).json({ success: false, message: "You can only delete your own messages for everyone" });
      }

      const hoursDiff = (Date.now() - new Date(message.createdAt || Date.now()).getTime()) / (1000 * 60 * 60);
      if (hoursDiff > 24) {
        return res.status(400).json({ success: false, message: "Messages can only be deleted for everyone within 24 hours" });
      }

      // Permanent hard delete from MongoDB array (frees up DB storage permanently)
      chat.messages = chat.messages.filter(
        (m: any) => String(m._id || m.id) !== String(messageId)
      ) as any;
    } else {
      // Permanent hard delete from MongoDB array for user (frees up DB storage permanently)
      chat.messages = chat.messages.filter(
        (m: any) => String(m._id || m.id) !== String(messageId)
      ) as any;
    }

    await chat.save();
    await chat.populate("participants", "fullName username email mobile profilePhotoUrl isOnline lastActive");
    await chat.populate("messages.sender", "fullName username email profilePhotoUrl");

    return res.json({ success: true, message: "Message permanently deleted from database", chat });

  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to delete message" });
  }
};
