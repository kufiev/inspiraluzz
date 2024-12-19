
const { storeContentDraftData } = require('../../services/storeData');

const { Firestore } = require('@google-cloud/firestore');

require('dotenv').config();

const jwt = require('jsonwebtoken');
const db = new Firestore();

async function postDraftContentHandler(request, h) {
  const { title, content } = request.payload;
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
  if (!title || !content) {
    return h
      .response({
        status: 'fail',
        message: 'Title dan content harus disediakan',
      })
      .code(400);
  }

  try {
    const createdAt = new Date().toISOString();
    const updatedAt = createdAt;

    await storeContentDraftData({
      title,
      content,
      userUid: user.uid,
      createdAt,
      updatedAt,
    });

    return h
      .response({
        status: 'success',
        message: 'Draft berhasil disimpan',
        data: {
          title,
          content,
          createdAt,
          updatedAt,
        },
      })
      .code(201);
  } catch (error) {
    console.error('Error saving draft content:', error);
    return h
      .response({
        status: 'error',
        message: 'Gagal menyimpan draft.',
      })
      .code(500);
  }
}

async function updateDraftContentHandler(request, h) {
  const { title, content } = request.payload;
  const { draftId } = request.params; // Get draftId from request params
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
  if (!title || !content) {
    return h
      .response({
        status: 'fail',
        message: 'Title dan content harus disediakan',
      })
      .code(400);
  }

  try {
    const updatedAt = new Date().toISOString();

    const draftRef = db
      .collection('contentDrafts')
      .doc(user.uid)
      .collection('draftsItems')
      .doc(draftId);
    const draftSnapshot = await draftRef.get();

    if (!draftSnapshot.exists) {
      return h
        .response({
          status: 'fail',
          message: 'Draft tidak ditemukan',
        })
        .code(404);
    }

    const draftData = draftSnapshot.data();
    if (draftData.userUid !== user.uid) {
      return h
        .response({
          status: 'fail',
          message: 'Anda tidak memiliki izin untuk memperbarui draft ini',
        })
        .code(403);
    }

    await draftRef.update({
      title,
      content,
      updatedAt,
    });

    return h
      .response({
        status: 'success',
        message: 'Draft berhasil diperbarui',
        data: {
          draftId,
          title,
          content,
          updatedAt,
        },
      })
      .code(200);
  } catch (error) {
    console.error('Error updating draft content:', error);
    return h
      .response({
        status: 'error',
        message: 'Gagal memperbarui draft.',
      })
      .code(500);
  }
}

async function getDraftContentHandler(request, h) {
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
      .collection('contentDrafts')
      .doc(user.uid)
      .collection('draftsItems');
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

async function deleteDraftContentHandler(request, h) {
  const { draftId } = request.params; // Get draftId from request params
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

  try {
    const draftRef = db
      .collection('contentDrafts')
      .doc(user.uid)
      .collection('draftsItems')
      .doc(draftId);
    const draftSnapshot = await draftRef.get();

    if (!draftSnapshot.exists) {
      return h
        .response({
          status: 'fail',
          message: 'Draft tidak ditemukan',
        })
        .code(404);
    }

    const draftData = draftSnapshot.data();
    if (draftData.userUid !== user.uid) {
      return h
        .response({
          status: 'fail',
          message: 'Anda tidak memiliki izin untuk menghapus draft ini',
        })
        .code(403);
    }

    await draftRef.delete();

    return h
      .response({
        status: 'success',
        message: 'Draft berhasil dihapus',
      })
      .code(200);
  } catch (error) {
    console.error('Error deleting draft content:', error);
    return h
      .response({
        status: 'error',
        message: 'Gagal menghapus draft.',
      })
      .code(500);
  }
}

module.exports = {
  postDraftContentHandler,
  getDraftContentHandler,
  updateDraftContentHandler,
  deleteDraftContentHandler,
};
