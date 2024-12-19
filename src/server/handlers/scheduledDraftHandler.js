const { Firestore } = require('@google-cloud/firestore');
const { Storage } = require('@google-cloud/storage');
const { storeDraftContentData } = require('../../services/storeData');

require('dotenv').config();

const jwt = require('jsonwebtoken');
const moment = require('moment');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = new Firestore();
const storage = new Storage();
const bucketName = process.env.CLOUD_STORAGE_BUCKET;

async function postScheduledDraftContentHandler(request, h) {
  const {
    title,
    description,
    keywords,
    category,
    privacyStatus,
    scheduledTime,
    platform,
  } = request.payload;
  const file = request.payload.file;
  const authHeader = request.headers.authorization || request.state.token;

  // Cek keberadaan header otorisasi
  if (!authHeader) {
    return h
      .response({
        status: 'fail',
        message: 'Header otorisasi tidak ditemukan',
      })
      .code(401);
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : authHeader;

  let user;
  try {
    // Pastikan JWT_SECRET ada
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }
    user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    console.error('Token validation error:', error);
    return h
      .response({
        status: 'fail',
        message: 'Token tidak valid',
      })
      .code(401);
  }

  // Validasi field yang diperlukan
  if (
    !title ||
    !description ||
    !keywords ||
    !category ||
    !privacyStatus ||
    !scheduledTime ||
    !platform ||
    !file
  ) {
    return h
      .response({
        status: 'fail',
        message:
          'Title, deskripsi, kata kunci, kategori, status privasi, waktu penjadwalan, platform, dan file harus disediakan',
      })
      .code(400);
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
    const normalizedScheduledTime = moment(scheduledTime).toISOString();

    await storeDraftContentData({
      title,
      description,
      keywords,
      category,
      privacyStatus,
      mediaUrl,
      userUid: user.uid,
      scheduledTime: normalizedScheduledTime,
      platform,
      status: 'draft',
    });

    return h
      .response({
        status: 'success',
        message: 'Konten draft berhasil disimpan',
        data: {
          title,
          description,
          keywords,
          category,
          privacyStatus,
          mediaUrl,
          scheduledTime,
          platform,
          status: 'draft',
        },
      })
      .code(201);
  } catch (error) {
    console.error('Error handling draft content:', error);
    return h
      .response({
        status: 'error',
        message: 'Gagal menyimpan konten draft.',
      })
      .code(500);
  }
}

async function getScheduledDraftContentHandler(request, h) {
  const authHeader = request.headers.authorization || request.state.token;

  if (!authHeader) {
    return h
      .response({
        status: 'fail',
        message: 'Header otorisasi tidak ditemukan',
      })
      .code(401);
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : authHeader;

  let user;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return h
      .response({
        status: 'fail',
        message: 'Token tidak valid',
      })
      .code(401);
  }

  try {
    const draftsCollection = db
      .collection('drafts')
      .doc(user.uid)
      .collection('items');
    const snapshot = await draftsCollection.get();

    if (snapshot.empty) {
      return h
        .response({
          status: 'success',
          message: 'Tidak ada konten draf yang ditemukan',
          data: [],
        })
        .code(200);
    }

    const drafts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return h
      .response({
        status: 'success',
        message: 'Konten draf berhasil diambil',
        data: drafts,
      })
      .code(200);
  } catch (error) {
    console.error('Kesalahan saat mengambil konten draf:', error);
    return h
      .response({
        status: 'error',
        message: 'Gagal mengambil konten draf.',
      })
      .code(500);
  }
}

async function updateScheduledDraftContentHandler(request, h) {
  const { draftId } = request.params; // Get draft ID from URL params
  const {
    title,
    description,
    keywords,
    category,
    privacyStatus,
    scheduledTime,
    platform,
  } = request.payload;
  const file = request.payload.file; // File baru untuk diunggah
  const authHeader = request.headers.authorization || request.state.token;

  if (!authHeader) {
    return h
      .response({
        status: 'fail',
        message: 'Header otorisasi tidak ditemukan',
      })
      .code(401);
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : authHeader;

  let user;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return h
      .response({
        status: 'fail',
        message: 'Token tidak valid',
      })
      .code(401);
  }

  if (!draftId) {
    return h
      .response({
        status: 'fail',
        message: 'Draft ID diperlukan.',
      })
      .code(400);
  }

  try {
    const draftRef = db
      .collection('drafts')
      .doc(user.uid)
      .collection('items')
      .doc(draftId);

    // Check if the draft exists
    const draftDoc = await draftRef.get();
    if (!draftDoc.exists) {
      return h
        .response({
          status: 'fail',
          message: 'Draft tidak ditemukan.',
        })
        .code(404);
    }

    let mediaUrl = draftDoc.data().mediaUrl;

    // If a new file is provided, upload the new file and delete the old one
    if (file) {
      console.log('File baru ditemukan, mengunggah file...');

      // Generate new unique file name
      const uniqueFileName = `${uuidv4()}-${file.hapi.filename}`;
      const userFolderPath = `drafts/${user.uid}`;
      const newFilePath = `${userFolderPath}/${uniqueFileName}`;

      // Create bucket file reference
      const bucket = storage.bucket(bucketName);
      const blob = bucket.file(newFilePath);
      const stream = blob.createWriteStream({
        resumable: false,
        metadata: { contentType: file.hapi.headers['content-type'] },
      });

      // Upload the new file
      await new Promise((resolve, reject) => {
        file.pipe(stream).on('error', reject).on('finish', resolve);
      });

      // Construct the new media URL
      const newMediaUrl = `https://storage.googleapis.com/${bucketName}/${newFilePath}`;
      console.log('File baru berhasil diunggah:', newMediaUrl);

      // Delete the old file if it exists
      if (mediaUrl) {
        const oldFilePath = mediaUrl.split(`${bucketName}/`)[1];
        const oldFile = bucket.file(oldFilePath);
        try {
          await oldFile.delete();
          console.log('File lama berhasil dihapus:', oldFilePath);
        } catch (error) {
          if (error.code === 404) {
            console.warn(
              'File lama tidak ditemukan, mungkin sudah dihapus:',
              oldFilePath
            );
          } else {
            throw error;
          }
        }
      }

      // Update the media URL to the new file's URL
      mediaUrl = newMediaUrl;
    }

    // Update fields in the draft document
    await draftRef.update({
      title,
      description,
      keywords,
      category,
      privacyStatus,
      scheduledTime: moment(scheduledTime).toISOString(),
      platform,
      mediaUrl, // Update the media URL if new file is uploaded
    });

    return h
      .response({
        status: 'success',
        message: 'Konten draft berhasil diperbarui',
        data: {
          draftId,
          title,
          description,
          category,
          privacyStatus,
          scheduledTime,
          platform,
          mediaUrl,
        },
      })
      .code(200);
  } catch (error) {
    console.error('Kesalahan saat memperbarui konten draf:', error);
    return h
      .response({
        status: 'error',
        message: 'Gagal memperbarui konten draft.',
      })
      .code(500);
  }
}

async function deleteScheduledDraftContentHandler(request, h) {
  const { draftId } = request.params; // Get draft ID from URL params

  const authHeader = request.headers.authorization || request.state.token;

  if (!authHeader) {
    return h
      .response({
        status: 'fail',
        message: 'Header otorisasi tidak ditemukan',
      })
      .code(401);
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : authHeader;

  let user;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return h
      .response({
        status: 'fail',
        message: 'Token tidak valid',
      })
      .code(401);
  }

  if (!draftId) {
    return h
      .response({
        status: 'fail',
        message: 'Draft ID diperlukan.',
      })
      .code(400);
  }

  try {
    const draftRef = db
      .collection('drafts')
      .doc(user.uid)
      .collection('items')
      .doc(draftId);

    // Check if the draft exists
    const draftDoc = await draftRef.get();
    if (!draftDoc.exists) {
      return h
        .response({
          status: 'fail',
          message: 'Draft tidak ditemukan.',
        })
        .code(404);
    }

    const draftData = draftDoc.data();

    // Delete the file from Google Cloud Storage
    if (draftData.mediaUrl) {
      const filePath = draftData.mediaUrl.split(
        `https://storage.googleapis.com/${bucketName}/`
      )[1];
      const file = storage.bucket(bucketName).file(filePath);

      try {
        await file.delete();
        console.log(`File ${filePath} successfully deleted from storage.`);
      } catch (error) {
        console.error(`Error deleting file from storage:`, error);
        // Optionally return an error or proceed with deleting the draft
      }
    }

    // Delete the draft document
    await draftRef.delete();

    return h
      .response({
        status: 'success',
        message: 'Konten draft dan file berhasil dihapus',
      })
      .code(200);
  } catch (error) {
    console.error('Kesalahan saat menghapus konten draf:', error);
    return h
      .response({
        status: 'error',
        message: 'Gagal menghapus konten draft.',
      })
      .code(500);
  }
}

module.exports = {
  postScheduledDraftContentHandler,
  getScheduledDraftContentHandler,
  updateScheduledDraftContentHandler,
  deleteScheduledDraftContentHandler,
};
