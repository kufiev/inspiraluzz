const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Firestore } = require('@google-cloud/firestore');

require('dotenv').config();

const db = new Firestore();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

async function generateChat(queryText, userUid, chatId) {
  try {
    // Reference the existing chat document by chatId
    const chatRef = db
      .collection('chats')
      .doc(userUid)
      .collection('chatsItems')
      .doc(chatId);

    const chatDoc = await chatRef.get();

    // If the document does not exist, throw an error
    if (!chatDoc.exists) {
      throw new Error('Chat with the specified ID does not exist');
    }

    // Retrieve the existing chat history or initialize it
    let chatHistory = chatDoc.data().chatHistory || [];

    // Add the new user message to the chat history
    chatHistory.push({
      role: 'user',
      parts: queryText,
      timestamp: new Date().toISOString(),
    });

    // Create a prompt by concatenating the chat history
    const prompt = chatHistory
      .map((item) => `${item.role}: ${item.parts}`)
      .join('\n');

    // Generate the model's response
    const result = await model.generateContent(prompt);
    const modelResponse = result.response.text();

    // Add the model's response to the chat history
    chatHistory.push({
      role: 'model',
      parts: modelResponse,
      timestamp: new Date().toISOString(),
    });

    // Update the chat history in Firestore
    await chatRef.update({
      chatHistory,
      updatedAt: new Date().toISOString(), // Optional: track when the chat was last updated
    });

    return {
      result: modelResponse, // Return the model's response
      chatHistory, // Return the updated chat history
    };
  } catch (error) {
    console.error('Error in generateChat:', error);
    throw new Error('Failed to generate chat response.');
  }
}

module.exports = { generateChat };
