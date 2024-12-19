const { authenticate, getNewToken } = require('./oauthService');

require('dotenv').config();
const { google } = require('googleapis');
const { Firestore } = require('@google-cloud/firestore');
const { Storage } = require('@google-cloud/storage');

const db = new Firestore();
const storage = new Storage();

async function uploadVideo(
  auth,
  file,
  title,
  description,
  category,
  keywords,
  privacyStatus
) {
  const youtube = google.youtube({ version: 'v3', auth });

  const requestParameters = {
    part: 'snippet,status',
    requestBody: {
      snippet: {
        title,
        description,
        tags: keywords.split(','),
        categoryId: category,
      },
      status: {
        privacyStatus,
      },
    },
    media: {
      body: file,
    },
  };

  try {
    const res = await youtube.videos.insert(requestParameters);
    console.log(`Video uploaded successfully! Video ID: ${res.data.id}`);
  } catch (error) {
    if (error.message.includes('quotaExceeded')) {
      console.error('Quota exceeded, re-authenticating...');
      const newAuth = await getNewToken(auth, userRef);
      await uploadVideo(
        newAuth,
        file,
        title,
        description,
        category,
        keywords,
        privacyStatus
      );
    } else {
      console.error('Error uploading video:', error.message);
    }
  }
}

async function postDraftToYouTube(userUid, draftId) {
  try {
    const draftRef = db
      .collection('drafts')
      .doc(userUid)
      .collection('items')
      .doc(draftId);
    const draftSnapshot = await draftRef.get();

    if (!draftSnapshot.exists) {
      console.error('Draft not found!');
      return;
    }

    const draftData = draftSnapshot.data();
    const { title, description, category, keywords, privacyStatus, mediaUrl } =
      draftData;

    if (!mediaUrl) {
      console.error('No media file found for this draft.');
      return;
    }

    const filePath = mediaUrl.replace(
      `https://storage.googleapis.com/${process.env.CLOUD_STORAGE_BUCKET}/`,
      ''
    );
    const fileStream = storage
      .bucket(process.env.CLOUD_STORAGE_BUCKET)
      .file(filePath)
      .createReadStream();

    const auth = await authenticate(userUid);
    await uploadVideo(
      auth,
      fileStream,
      title,
      description,
      category,
      keywords || '',
      privacyStatus
    );

    await draftRef.update({
      status: 'published',
      processedAt: new Date().toISOString(),
    });
    console.log(`Draft ${draftId} marked as published.`);
  } catch (error) {
    console.error('Error posting draft to YouTube:', error.message);
  }
}

module.exports = { postDraftToYouTube };
