const { Firestore } = require('@google-cloud/firestore');
const { storeChatData } = require('../../services/storeData');
const { generateChat } = require('../../services/chatService');

require('dotenv').config();

const jwt = require('jsonwebtoken');
const db = new Firestore();

async function newChatHandler(request, h) {
  const { topic } = request.payload;
  const token = request.state.token;

  if (!token) {
    return h
      .response({
        status: 'fail',
        message: 'Header otorisasi tidak ditemukan',
      })
      .code(401);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userUid = decoded.uid;

    const chatId = await storeChatData(userUid, [], topic);

    return h
      .response({
        status: 'success',
        message: 'Chat baru berhasil dibuat',
        chatId,
      })
      .code(201);
  } catch (error) {
    console.error('Error in newChatHandler:', error);
    return h
      .response({
        status: 'error',
        message: 'Gagal memproses permintaan chat baru.',
      })
      .code(500);
  }
}

async function chatHandler(request, h) {
  const { chatId } = request.params;
  const { prompt } = request.payload;

  try {
    const token = request.state.token;
    if (!token) {
      return h
        .response({ status: 'fail', message: 'Token tidak ditemukan' })
        .code(401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userUid = decoded.uid;

    const { result, chatHistory } = await generateChat(prompt, userUid, chatId);

    return h.response({ status: 'success', result, chatHistory }).code(200);
  } catch (error) {
    console.error('Error in chatByIdHandler:', error);
    return h
      .response({ status: 'error', message: 'Gagal memproses chat.' })
      .code(500);
  }
}

async function deleteChatHandler(request, h) {
  const { chatId } = request.params;
  const token = request.state.token;
  if (!token) {
    return h
      .response({ status: 'fail', message: 'Token tidak ditemukan' })
      .code(401);
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const userUid = decoded.uid;

  try {
    const chatRef = db
      .collection('chats')
      .doc(userUid)
      .collection('chatsItems')
      .doc(chatId);
    const chatDoc = await chatRef.get();

    if (!chatDoc.exists) {
      return h
        .response({ status: 'fail', message: 'Chat tidak ditemukan' })
        .code(404);
    }

    await chatRef.delete();
    return h
      .response({ status: 'success', message: 'Chat berhasil dihapus' })
      .code(200);
  } catch (error) {
    console.error('Error deleting chat:', error);
    return h
      .response({ status: 'error', message: 'Gagal menghapus chat.' })
      .code(500);
  }
}

async function getChatHandler(request, h) {
  const token = request.state.token;
  if (!token) {
    return h
      .response({ status: 'fail', message: 'Token tidak ditemukan' })
      .code(401);
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const userUid = decoded.uid;

  try {
    const chatsRef = db
      .collection('chats')
      .doc(userUid)
      .collection('chatsItems');

    const chatsSnapshot = await chatsRef.get();

    if (chatsSnapshot.empty) {
      return h
        .response({ status: 'success', message: 'Tidak ada chat yang ditemukan' })
        .code(200);
    }

    const chats = chatsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return h.response({ status: 'success', data: chats }).code(200);
  } catch (error) {
    console.error('Error fetching chats:', error);
    return h
      .response({ status: 'error', message: 'Gagal mendapatkan chats.' })
      .code(500);
  }
}

module.exports = {
  newChatHandler,
  chatHandler,
  getChatHandler,
  deleteChatHandler,
};
