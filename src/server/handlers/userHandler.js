const { Firestore } = require('@google-cloud/firestore');
const { registerUser, loginUser } = require('../../services/authService');
const { google } = require('googleapis');

require('dotenv').config();

const Joi = require('joi');
const jwt = require('jsonwebtoken');
const db = new Firestore();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

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
        'any.only': 'Kata sandi dan konfirmasi kata sandi tidak cocok.',
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
        message: 'Pengguna berhasil didaftarkan',
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
        message: 'Pengguna berhasil login',
        data: user,
      })
      .state('token', user.token, {
        path: '/',
        isHttpOnly: true,
        isSecure: true,
        sameSite: 'Lax',
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

async function verifyTokenHandler(request, h) {
  const token = request.state.token;

  if (!token) {
    return h
      .response({
        status: 'fail',
        message: 'Header otorisasi tidak ditemukan',
      })
      .code(401);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userDoc = await db.collection('users').doc(decoded.uid).get();

    const userData = userDoc.data();

    return h
      .response({
        status: 'success',
        message: 'Token valid',
        data: {
          token,
          uid: decoded.uid,
          fullName: userData.fullName,
          email: userData.email,
          contentType: userData.contentType,
          socialMedia: userData.socialMedia,
          exp: decoded.exp,
        },
      })
      .code(200);
  } catch (error) {
    console.error('Error verifying token:', error);

    const errorMessage =
      error.name === 'TokenExpiredError'
        ? 'Token telah kedaluwarsa'
        : 'Token tidak valid';

    return h
      .response({
        status: 'fail',
        message: errorMessage,
      })
      .code(401);
  }
}

async function logoutHandler(request, h) {
  return h
    .response({
      status: 'success',
      message: 'Logout berhasil',
    })
    .unstate('token', {
      path: '/',
      isHttpOnly: true,
      isSecure: true,
      isSameSite: 'None',
    })
    .code(200);
}

async function updateUserHandler(request, h) {
  const { contentType, platform, access_token } = request.payload;
  const token = request.state.token;

  if (!token) {
    return h
      .response({
        status: 'fail',
        message: 'Header otorisasi tidak ditemukan',
      })
      .code(401);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userRef = db.collection('users').doc(decoded.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return h
        .response({
          status: 'fail',
          message: 'Pengguna tidak ditemukan',
        })
        .code(404);
    }

    if (contentType) {
      await userRef.update({ contentType });
    }

    const userData = userDoc.data();
    const youtubeData = userData.socialMedia?.find(
      (item) => item.platform === 'youtube'
    );

    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );

    if (access_token) {
      const decodedCode = decodeURIComponent(access_token);

      const { tokens } = await oauth2Client.getToken(decodedCode);
      oauth2Client.setCredentials(tokens);

      const userSnapshot = await userRef.get();
      const userData = userSnapshot.data();
      let currentSocialMedia = userData.socialMedia || [];

      const updatedSocialMedia = currentSocialMedia.filter(
        (item) => item.platform !== 'youtube'
      );

      updatedSocialMedia.push({
        platform: 'youtube',
        token: tokens,
      });

      await userRef.set(
        {
          socialMedia: updatedSocialMedia,
        },
        { merge: true }
      );

      console.log('Token stored to Firestore');
    } else if (
      !youtubeData ||
      !youtubeData.token ||
      youtubeData.token.expiry_date <= Date.now()
    ) {
      if (youtubeData?.token?.refresh_token) {
        try {
          oauth2Client.setCredentials(youtubeData.token);
          const { credentials } = await oauth2Client.refreshAccessToken();
          oauth2Client.setCredentials(credentials);

          const updatedSocialMedia = userData.socialMedia.map((item) =>
            item.platform === 'youtube'
              ? { platform: 'youtube', token: credentials }
              : item
          );
          await userRef.set(
            {
              socialMedia: updatedSocialMedia,
            },
            { merge: true }
          );

          console.log('Token refreshed and updated in Firestore');
        } catch (error) {
          console.error('Error refreshing token:', error);
          return h
            .response({
              status: 'error',
              message: 'Gagal memperbarui token.',
            })
            .code(500);
        }
      } else {
        const authUrl = oauth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: SCOPES,
          prompt: 'consent',
        });

        return h
          .response({
            status: 'auth_required',
            message:
              'Token YouTube tidak valid atau kadaluwarsa. Silakan otorisasi ulang.',
            authUrl,
          })
          .code(200);
      }
    }

    const updateData = {};
    if (contentType) updateData.contentType = contentType;
    await userRef.update(updateData);

    return h
      .response({
        status: 'success',
        message: 'Data berhasil diperbarui',
      })
      .code(200);
  } catch (error) {
    console.error('Error:', error);
    return h
      .response({
        status: 'error',
        message: 'Gagal memperbarui data pengguna.',
      })
      .code(500);
  }
}

async function updateUserTokenHandler(request, h) {
  const { code } = request.query;

  if (!code) {
    return h
      .response({
        status: 'fail',
        message: 'code is missing',
      })
      .code(400);
  }
  try {
    return h
      .response(
        `
     <html>
  
  <head>
      <title>Authorization Success</title>
  
      <style>
          #message {
              text-align: center;
              font-size: 2rem;
          }
  
          body {
              display: grid;
              place-items: center;
              min-height: 100vh;
              min-width: 100%;
          }
      </style>
  </head>
  
  <body>
      <h1 id="message">Sedang memverifikasi....</h1>
  </body>
  <script>
      const message = document.getElementById("message")
      function getQueryParams() {
          const urlParams = new URLSearchParams(window.location.search)
          return {
              code: urlParams.get('code') || null,
              platform: urlParams.get('platform') || null,
          }
      }
  
      async function updateUserToken(platform, code) {
          try {
              const request = await fetch('https://inspiraluzz-api-1004799976900.asia-southeast2.run.app/update-users', {
                  credentials: 'include',
                  method: 'PUT',
                  headers: {
                  'Content-Type': 'application/json',
              },
                  body: JSON.stringify({
                      platform: platform,
                      access_token: code
                  })
              })
              message.textContent = 'Verifikasi berhasil. Silahkan kembali ke halaman sebelumnya'
          } catch (err) {
              message.textContent = 'Verifikasi Gagal. Coba lagi'
          }
      }
  
      function initPage() {
          const { code, platform } = getQueryParams();
          setTimeout(() => {
              updateUserToken(platform, code)
          }, 1000)
  
      }
      document.addEventListener('DOMContentLoaded', initPage)
  </script>
  
  </html>
      `
      )
      .type('text/html')
      .code(200);
  } catch (error) {
    console.error('Error handling OAuth token:', error);

    return h
      .response({
        status: 'error',
        message: 'Failed to handle YouTube OAuth token.',
      })
      .code(500);
  }
}

module.exports = {
  registerHandler,
  loginHandler,
  verifyTokenHandler,
  logoutHandler,
  updateUserHandler,
  updateUserTokenHandler,
};
