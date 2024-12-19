const { Firestore } = require('@google-cloud/firestore');

require('dotenv').config();

const jwt = require('jsonwebtoken');
const db = new Firestore();

async function getTopicHandler(request, h) {
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

  const { category, limit } = request.query;

  if (!category) {
    return h
      .response({
        status: 'fail',
        message: 'Parameter kategori query diperlukan.',
      })
      .code(400);
  }

  const pageLimit = parseInt(limit, 10) || 10;

  try {
    const categoryDoc = db.collection('categories').doc(category);
    const topicsSnapshot = await categoryDoc
      .collection('topics')
      .limit(pageLimit)
      .get();

    if (topicsSnapshot.empty) {
      return h
        .response({
          status: 'fail',
          message: `Tidak ada data ditemukan untuk kategori: ${category}`,
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
        message: `Data berhasil diambil untuk kategori: ${category}`,
        data,
      })
      .code(200);
  } catch (error) {
    console.error('Error retrieving data:', error);
    return h
      .response({
        status: 'error',
        message: 'Gagal mengambil data.',
      })
      .code(500);
  }
}

module.exports = { getTopicHandler };
