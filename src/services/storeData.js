const { Firestore } = require('@google-cloud/firestore');
const { v4: uuidv4 } = require('uuid');
const db = new Firestore();

async function storeUserData(uid, data) {
  const userCollection = db.collection('users');
  try {
    await userCollection.doc(uid).set(data);
  } catch (error) {
    console.error('Kesalahan menyimpan data pengguna:', error);
    throw new Error('Gagal menyimpan data pengguna');
  }
}

async function storeDraftContentData({
  title,
  description,
  keywords,
  category,
  privacyStatus,
  mediaUrl,
  userUid,
  scheduledTime,
  platform,
  status = 'pending',
}) {
  const draftsCollection = db
    .collection('drafts')
    .doc(userUid)
    .collection('items');

  try {
    const draftId = uuidv4();
    const draftRef = draftsCollection.doc(draftId);

    await draftRef.set({
      draftId,
      title: title || 'Untitled',
      description: description || '',
      keywords: keywords || [],
      category: category || 'Uncategorized',
      privacyStatus: privacyStatus || 'private',
      mediaUrl: mediaUrl || null,
      userUid,
      scheduledTime: scheduledTime || new Date().toISOString(),
      platform: platform || 'unknown',
      status,
      createdAt: new Date().toISOString(),
    });

    console.log('Draft content saved successfully.');
  } catch (error) {
    console.error('Kesalahan menyimpan data konten draf:', error);
    throw new Error('Gagal menyimpan data konten draf');
  }
}

async function storeContentDraftData({
  title,
  content,
  userUid,
  createdAt = new Date().toISOString(),
  updatedAt = createdAt,
}) {
  const draftsCollection = db
    .collection('contentDrafts')
    .doc(userUid)
    .collection('draftsItems');

  try {
    const draftId = uuidv4();
    const draftRef = draftsCollection.doc(draftId);

    await draftRef.set({
      draftId,
      userUid,
      title,
      content,
      createdAt,
      updatedAt,
    });

    console.log('Content draft saved successfully.');
  } catch (error) {
    console.error('Kesalahan menyimpan content draft:', error);
    throw new Error('Gagal menyimpan content draft');
  }
}

async function storeChatData(userUid, chatHistory, topic) {
  try {
    const chatsCollection = db
      .collection('chats')
      .doc(userUid)
      .collection('chatsItems');

    const chatId = uuidv4();
    const chatRef = chatsCollection.doc(chatId);
    await chatRef.set(
      {
        chatId,
        userUid,
        chatHistory,
        topic,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    console.log('Chat data successfully updated for:', chatId);
    return chatId;
  } catch (error) {
    console.error('Error storing chat data:', error);
    throw new Error('Failed to store chat data.');
  }
}

module.exports = {
  storeUserData,
  storeDraftContentData,
  storeContentDraftData,
  storeChatData,
};
