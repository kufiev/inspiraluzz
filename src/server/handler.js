const { Firestore } = require('@google-cloud/firestore');
const crypto = require('crypto');
const ClientError = require('../exceptions/ClientError');
const Joi = require('joi');
const jwt = require('jsonwebtoken');
const { registerUser, loginUser } = require('../services/authService');
const {
  storePredictionData,
  storeOverallPredictionData,
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

  const authHeader = request.headers.authorization || request.state.token;

  if (!authHeader) {
    const response = h.response({
      status: 'fail',
      message: 'Authorization header is missing',
    });
    response.code(401);
    return response;
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : authHeader;

  let user;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    const response = h.response({
      status: 'fail',
      message: 'Invalid token',
    });
    response.code(401);
    return response;
  }

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
  const { text } = request.payload;
  const { model, tokenizer } = request.server.app;

  const authHeader = request.headers.authorization || request.state.token;

  if (!authHeader) {
    const response = h.response({
      status: 'fail',
      message: 'Authorization header is missing',
    });
    response.code(401);
    return response;
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : authHeader;

  let user;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    const response = h.response({
      status: 'fail',
      message: 'Invalid token',
    });
    response.code(401);
    return response;
  }

  if (!text || !Array.isArray(text)) {
    return h
      .response({
        status: 'fail',
        message: 'Input text must be a non-empty array of strings.',
      })
      .code(400);
  }

  try {
    const labels = await overallSentiment({ model, tokenizer }, text);

    await storeOverallPredictionData({ text, labels });

    return h
      .response({
        status: 'success',
        message: 'Data is stored successfully.',
        data: { text, labels },
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

module.exports = {
  registerHandler,
  loginHandler,
  postPredictHandler,
  postOverallSentimentHandler,
};
