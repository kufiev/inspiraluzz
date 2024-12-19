require('dotenv').config();
const { google } = require('googleapis');
const { Firestore } = require('@google-cloud/firestore');
const db = new Firestore();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

async function authenticate(userUid) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );

    const userRef = db.collection('users').doc(userUid);
    const userSnapshot = await userRef.get();

    if (userSnapshot.exists) {
      const userData = userSnapshot.data();
      const youtubeTokenData = userData.socialMedia?.find(
        (item) => item.platform === 'youtube'
      );

      if (youtubeTokenData && youtubeTokenData.token) {
        const { token } = youtubeTokenData;

        if (token.expiry_date && Date.now() < token.expiry_date) {
          oauth2Client.setCredentials(token);
          console.log('Using existing valid token.');
          return oauth2Client;
        }

        console.log('Token expired, please reauthenticate.');
      }
    }

    console.log('No valid YouTube token found, please reauthenticate.');
  } catch (error) {
    console.error('Error in authenticate function:', error);
    throw error;
  }
}

module.exports = { authenticate };
