const { Firestore } = require('@google-cloud/firestore');

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

async function storeOverallPredictionData(data) {
  const db = new Firestore();
  const overallPredictionsCollection = db.collection('overall_predictions');
  return overallPredictionsCollection.add({
    ...data,
    createdAt: new Date().toISOString(),
  });
}

module.exports = {
  storeUserData,
  storePredictionData,
  storeOverallPredictionData,
};
