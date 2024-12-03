const { Firestore } = require('@google-cloud/firestore');
const { v4: uuidv4 } = require('uuid');
const db = new Firestore();

async function storeUserData(uid, data) {
  const db = new Firestore();
  const userCollection = db.collection('users');
  return userCollection.doc(uid).set(data);
}

async function storePredictionData(data) {
  const db = new Firestore();
  const predictionsCollection = db.collection('predictions');
  return predictionsCollection.add({
    ...data,
    createdAt: new Date().toISOString(),
  });
}

async function storeOverallPredictionData({
  category,
  topic,
  summary,
  sentiment,
}) {
  const db = new Firestore();
  const categoryCollection = db.collection('categories');

  const topicId = uuidv4();

  const categoryDoc = categoryCollection.doc(category);
  const topicsCollection = categoryDoc.collection('topics');

  try {
    const existingTopicSnapshot = await topicsCollection
      .where('topic', '==', topic)
      .limit(1)
      .get();

    if (!existingTopicSnapshot.empty) {
      const existingTopicDoc = existingTopicSnapshot.docs[0];
      await existingTopicDoc.ref.update({
        summary,
        sentiment,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await topicsCollection.doc(topicId).set({
        id: topicId,
        topic,
        summary,
        sentiment,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Error storing Firestore data:', error);
    throw new Error('Failed to store overall prediction data');
  }
}

async function storeDraftContentData({ title, caption, mediaUrl, userUid, scheduledTime, platform }) {
  const draftsCollection = db.collection('drafts').doc(userUid).collection('items'); // Adjust Firestore path if needed
  const draftId = uuidv4();

  try {
    await draftsCollection.doc(draftId).set({
      id: draftId,
      title,
      caption,
      mediaUrl,
      scheduledTime,
      platform,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error storing draft content data:', error);
    throw new Error('Failed to store draft content data');
  }
}

module.exports = {
  storeUserData,
  storePredictionData,
  storeOverallPredictionData,
  storeDraftContentData,
};
