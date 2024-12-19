const { authenticate, getNewToken } = require('./oauthService');

require('dotenv').config();
const { google } = require('googleapis');
const { Firestore } = require('@google-cloud/firestore');
const { Storage } = require('@google-cloud/storage');

const db = new Firestore();
const storage = new Storage();

// Function to upload the video to YouTube
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
    // Handle quota exceeded error and reauthenticate
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

// Function to post draft content to YouTube
async function postDraftToYouTube(userUid, draftId) {
  try {
    // Fetch the draft details from Firestore
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

    // Get the file path from GCS
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

    // Authenticate and upload the video to YouTube
    const auth = await authenticate(userUid); // Pass userId to authenticate
    await uploadVideo(
      auth,
      fileStream,
      title,
      description,
      category,
      keywords || '',
      privacyStatus
    );

    // Update draft status to 'published' after successful upload
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
