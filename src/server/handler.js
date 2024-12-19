const { Firestore } = require('@google-cloud/firestore');
const db = new Firestore();

const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const bucketName = process.env.CLOUD_STORAGE_BUCKET;
const path = require('path');

const ALLOWED_USER_ID = '51c2fb36-ea2e-4fdd-b058-f5824ad75d2d';
const Joi = require('joi');
const jwt = require('jsonwebtoken');

const { v4: uuidv4 } = require('uuid');

const { registerUser, loginUser } = require('../services/authService');
const {
  storePredictionData,
  storeOverallPredictionData,
  storeDraftContentData,
} = require('../services/storeData');
const {
  predictSentiment,
  overallSentiment,
} = require('../services/inferenceService');

async function registerHandler(request, h) {
  const { fullName, email, password, confirmPassword } = request.payload;

  const schema = Joi.object({
    fullName: Joi.string().min(1).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    confirmPassword: Joi.string()
      .valid(Joi.ref('password'))
      .required()
      .messages({
        'any.only': 'The password and confirmation password do not match.',
      }),
  });

  const { error } = schema.validate({
    fullName,
    email,
    password,
    confirmPassword,
  });
  if (error) {
    return h
      .response({
        status: 'fail',
        message: error.details[0].message,
      })
      .code(400);
  }

  try {
    const user = await registerUser(email, password, fullName);
    return h
      .response({
        status: 'success',
        message: 'User registered successfully',
        data: {
          uid: user.uid,
          email: user.email,
          fullName: user.fullName,
        },
      })
      .code(201);
  } catch (err) {
    return h
      .response({
        status: 'fail',
        message: err.message,
      })
      .code(400);
  }
}

async function loginHandler(request, h) {
  const { email, password } = request.payload;

  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
  });

  const { error } = schema.validate({ email, password });
  if (error) {
    return h
      .response({
        status: 'fail',
        message: error.details[0].message,
      })
      .code(400);
  }

  try {
    const user = await loginUser(email, password);

    return h
      .response({
        status: 'success',
        message: 'User logged in successfully',
        data: user,
      })
      .state('token', user.token, {
        path: '/',
        isHttpOnly: true,
        isSecure: process.env.NODE_ENV === 'production',
      })
      .code(200);
  } catch (err) {
    return h
      .response({
        status: 'fail',
        message: err.message,
      })
      .code(400);
  }
}
async function postPredictHandler(request, h) {
  const { text } = request.payload;
  const { model, tokenizer } = request.server.app;

  if (!text || !Array.isArray(text)) {
    return h
      .response({
        status: 'fail',
        message: 'Text input must be a non-empty array of strings.',
      })
      .code(400);
  }

  try {
    const labels = await predictSentiment({ model, tokenizer }, text);
    await storePredictionData({ text, labels });

    return h
      .response({
        status: 'success',
        message: 'Data is stored successfully.',
        data: { text, labels },
      })
      .code(200);
  } catch (error) {
    console.error('Error during prediction:', error);
    return h
      .response({
        status: 'fail',
        message: `Prediction error: ${error.message}`,
      })
      .code(400);
  }
}

async function postOverallSentimentHandler(request, h) {
  const { category, topic, summary } = request.payload;
  const { model, tokenizer } = request.server.app;

  const token =
    request.state.token || request.headers.authorization?.split(' ')[1];
  if (!token) {
    return h
      .response({
        status: 'fail',
        message: 'Authentication required.',
      })
      .code(401);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.uid !== ALLOWED_USER_ID) {
      return h
        .response({
          status: 'fail',
          message: 'Unauthorized access.',
        })
        .code(403); // Forbidden
    }
  } catch (err) {
    console.error('JWT Verification error:', err);
    return h
      .response({
        status: 'fail',
        message: 'Invalid or expired token.',
      })
      .code(401);
  }

  if (!category || !topic || !summary) {
    return h
      .response({
        status: 'fail',
        message: 'Category, topic, and summary are required fields.',
      })
      .code(400);
  }

  try {
    const sentiment = await overallSentiment({ model, tokenizer }, [summary]);

    await storeOverallPredictionData({ category, topic, summary, sentiment });

    return h
      .response({
        status: 'success',
        message: 'Data is stored successfully.',
        data: { category, topic, summary, sentiment },
      })
      .code(200);
  } catch (error) {
    console.error('Overall sentiment error:', error);
    return h
      .response({
        status: 'fail',
        message: 'Failed to compute overall sentiment.',
      })
      .code(500);
  }
}

async function getOverallSentimentHandler(request, h) {
  const { category } = request.query;

  if (!category) {
    return h
      .response({
        status: 'fail',
        message: 'Category query parameter is required.',
      })
      .code(400);
  }

  try {
    const categoryDoc = db.collection('categories').doc(category);
    const topicsSnapshot = await categoryDoc.collection('topics').get();

    if (topicsSnapshot.empty) {
      return h
        .response({
          status: 'fail',
          message: `No data found for category: ${category}`,
        })
        .code(404);
    }

    const data = [];
    topicsSnapshot.forEach((doc) => {
      data.push({ id: doc.id, ...doc.data() });
    });

    return h
      .response({
        status: 'success',
        message: `Data retrieved successfully for category: ${category}`,
        data,
      })
      .code(200);
  } catch (error) {
    console.error('Error retrieving data:', error);
    return h
      .response({
        status: 'error',
        message: 'Failed to retrieve data.',
      })
      .code(500);
  }
}

async function postDraftContentHandler(request, h) {
  const { title, caption, scheduledTime, platform } = request.payload;
  const file = request.payload.file;
  const authHeader = request.headers.authorization || request.state.token;

  if (!authHeader) {
    return h.response({
      status: 'fail',
      message: 'Authorization header is missing',
    }).code(401);
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : authHeader;

  let user;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return h.response({
      status: 'fail',
      message: 'Invalid token',
    }).code(401);
  }

  if (!title || !caption || !file || !scheduledTime || !platform) {
    return h.response({
      status: 'fail',
      message: 'Title, caption, file, scheduled time, and platform must be provided',
    }).code(400);
  }

  const uniqueFileName = `${uuidv4()}-${file.hapi.filename}`;
  const userFolderPath = path.join('drafts', user.uid);
  const filePath = path.join(userFolderPath, uniqueFileName);

  try {
    const bucket = storage.bucket(bucketName);
    const blob = bucket.file(filePath);
    const stream = blob.createWriteStream({
      resumable: false,
      metadata: { contentType: file.hapi.headers['content-type'] },
    });

    await new Promise((resolve, reject) => {
      file.pipe(stream).on('error', reject).on('finish', resolve);
    });

    const mediaUrl = `https://storage.googleapis.com/${bucketName}/${filePath}`;

    await storeDraftContentData({
      title,
      caption,
      mediaUrl,
      userUid: user.uid,
      scheduledTime,
      platform,
    });

    return h.response({
      status: 'success',
      message: 'Draft content was successfully stored',
      data: { title, caption, mediaUrl, scheduledTime, platform },
    }).code(201);
  } catch (error) {
    console.error('Error handling draft content:', error);
    return h.response({
      status: 'error',
      message: 'Failed to store draft content.',
    }).code(500);
  }
}

async function getDraftContentHandler(request, h) {
  const authHeader = request.headers.authorization || request.state.token;

  if (!authHeader) {
    return h.response({
      status: 'fail',
      message: 'Authorization header is missing',
    }).code(401);
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : authHeader;

  let user;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return h.response({
      status: 'fail',
      message: 'Invalid token',
    }).code(401);
  }

  try {
    const draftsCollection = db.collection('drafts').doc(user.uid).collection('items');
    const snapshot = await draftsCollection.get();

    if (snapshot.empty) {
      return h.response({
        status: 'success',
        message: 'No draft content found',
        data: [],
      }).code(200);
    }

    const drafts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return h.response({
      status: 'success',
      message: 'Draft content retrieved successfully',
      data: drafts,
    }).code(200);
  } catch (error) {
    console.error('Error retrieving draft content:', error);
    return h.response({
      status: 'error',
      message: 'Failed to retrieve draft content.',
    }).code(500);
  }
}

module.exports = {
  registerHandler,
  loginHandler,
  postPredictHandler,
  postOverallSentimentHandler,
  getOverallSentimentHandler,
  postDraftContentHandler,
  getDraftContentHandler,
};
