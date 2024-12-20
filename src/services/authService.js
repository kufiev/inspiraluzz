const InputError = require('../exceptions/InputError');

require('dotenv').config();

const { Firestore } = require('@google-cloud/firestore');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = new Firestore();

async function hashPassword(password) {
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    return hash;
  } catch (error) {
    console.error('Kesalahan hashing:', error);
    throw error;
  }
}

async function registerUser(email, password, fullName) {
  try {
    const userCollection = db.collection('users');
    const snapshot = await userCollection.where('email', '==', email).get();
    if (!snapshot.empty) {
      throw new InputError('Email sudah terdaftar');
    }

    const hashedPassword = await hashPassword(password);
    const uid = uuidv4();
    const userData = {
      uid: uid,
      email: email,
      fullName: fullName,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    };

    await userCollection.doc(uid).set(userData);

    return { uid: uid, email: email, fullName: fullName };
  } catch (error) {
    throw new InputError(error.message);
  }
}

async function loginUser(email, password) {
  try {
    const userCollection = db.collection('users');
    const snapshot = await userCollection.where('email', '==', email).get();
    if (snapshot.empty) {
      throw new Error('Email atau kata sandi tidak valid');
    }

    let userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    const passwordIsValid = await bcrypt.compare(password, userData.password);

    if (!passwordIsValid) {
      throw new Error('Email atau kata sandi tidak valid');
    }
    const token = jwt.sign(
      {
        uid: userData.uid,
        email: userData.email,
        fullName: userData.fullName,
        contentType: userData.contentType || '',
        socialMedia: userData.socialMedia || [],
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    return {
      uid: userData.uid,
      email: userData.email,
      fullName: userData.fullName,
      contentType: userData.contentType || '',
      socialMedia: userData.socialMedia || [],
      token: token,
    };
  } catch {
    throw new InputError('Email atau kata sandi tidak valid');
  }
}

module.exports = { registerUser, loginUser };
