const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Firestore } = require('@google-cloud/firestore');

require('dotenv').config();

const db = new Firestore();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

async function generateChat(queryText, userUid, chatId) {
  try {
    const chatRef = db
      .collection('chats')
      .doc(userUid)
      .collection('chatsItems')
      .doc(chatId);

    const chatDoc = await chatRef.get();

    if (!chatDoc.exists) {
      throw new Error('Chat with the specified ID does not exist');
    }

    let chatHistory = chatDoc.data().chatHistory || [];

    chatHistory.push({
      role: 'user',
      parts: queryText,
      timestamp: new Date().toISOString(),
    });

    const prompt = chatHistory
      .map((item) => `${item.role}: ${item.parts}`)
      .join('\n');

    const result = await model.generateContent(prompt);
    const modelResponse = result.response.text();

    chatHistory.push({
      role: 'model',
      parts: modelResponse,
      timestamp: new Date().toISOString(),
    });

    await chatRef.update({
      chatHistory,
      updatedAt: new Date().toISOString(),
    });

    return {
      result: modelResponse,
      chatHistory,
    };
  } catch (error) {
    console.error('Error in generateChat:', error);
    throw new Error('Failed to generate chat response.');
  }
}

module.exports = { generateChat };
