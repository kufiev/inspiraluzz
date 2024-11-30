const tf = require('@tensorflow/tfjs-node');
const _ = require('lodash');

// HYPERPARAMETERS

const MAX_LENGTH = 16;
const PADDING_TYPE = 'post';
const TRUNCATING_TYPE = 'post';

function padSequencesJs(sequences, maxLength, padding = 'post', truncating = 'post') {
  return sequences.map(seq => {
    if (seq.length > maxLength) {
      // truncate the sequence
      return truncating === 'pre'
        ? seq.slice(seq.length - maxLength)
        : seq.slice(0, maxLength);
    } else if (seq.length < maxLength) {
      // pad the sequence
      const paddingArray = new Array(maxLength - seq.length).fill(0);
      return padding === 'pre' ? [...paddingArray, ...seq] : [...seq, ...paddingArray];
    }
    return seq;
  });
}

async function predictSentiment({ model, tokenizer }, text) {
  try {
    // const inputDim = 5000; // input_dim from embedding layer
    // const oovToken = 1;

    // // convert text to sequence
    // const sequences = text.map((t) => {
    //   return t.split(' ').map((word) => {
    //     const lowercasedWord = word.toLowerCase();
    //     const tokenIndex = tokenizer[lowercasedWord] || oovToken;
    //     return tokenIndex < inputDim ? tokenIndex : oovToken;
    //   });
    // });

    const inputDim = 5000; // input_dim from embedding layer
    const oovToken = 1;

    const sequences = text.map((t) => {
      return t.split(' ').map((word) => {
      const lowercasedWord = word.toLowerCase();
      const tokenIndex = tokenizer[lowercasedWord] || 0; // Default to 0 for padding/unseen words
      return tokenIndex < inputDim ? tokenIndex : oovToken; // Replace exceeding indices with OOV token
      });
    });

    // padding on sequences
    const paddedSequences = padSequencesJs(sequences, MAX_LENGTH, PADDING_TYPE, TRUNCATING_TYPE);

    // change to tensor
    const inputTensor = tf.tensor2d(paddedSequences, [paddedSequences.length, MAX_LENGTH]);

    // predict with model
    const predictions = model.predict(inputTensor);
    const labels = (await predictions.array()).map(pred => {
      const maxIndex = _.indexOf(pred, _.max(pred));
      return maxIndex - 1; // return the value -1, 0, atau 1
    });

    return labels;
  } catch (error) {
    console.error('Error during prediction:', error);
    throw new Error('Failed to predict sentiment');
  }
}

async function overallSentiment({ model, tokenizer }, text) {
  try {
    const inputDim = 5000; // input_dim from embedding layer
    const oovToken = 1;

    const sequences = text.map((t) => {
      return t.split(' ').map((word) => {
      const lowercasedWord = word.toLowerCase();
      const tokenIndex = tokenizer[lowercasedWord] || 0; // Default to 0 for padding/unseen words
      return tokenIndex < inputDim ? tokenIndex : oovToken; // Replace exceeding indices with OOV token
      });
    });

    // padding on sequences
    const paddedSequences = padSequencesJs(sequences, MAX_LENGTH, PADDING_TYPE, TRUNCATING_TYPE);

    // change to tensor
    const inputTensor = tf.tensor2d(paddedSequences, [paddedSequences.length, MAX_LENGTH]);

    // predict with model
    const predictions = model.predict(inputTensor);
    const labels = (await predictions.array()).map(pred => {
      const maxIndex = _.indexOf(pred, _.max(pred));
      return maxIndex - 1; // return value -1, 0, atau 1
    });

    // count sentiment distribution
    const sentimentCounts = _.countBy(labels);
    const totalCounts = labels.length;
    const negativePercentage = (sentimentCounts[-1] || 0) / totalCounts;
    const neutralPercentage = (sentimentCounts[0] || 0) / totalCounts;
    const positivePercentage = (sentimentCounts[1] || 0) / totalCounts;

    return {
      negative: parseFloat(negativePercentage.toFixed(2)),
      neutral: parseFloat(neutralPercentage.toFixed(2)),
      positive: parseFloat(positivePercentage.toFixed(2))
    };
  } catch (error) {
    console.error('Error during overall sentiment calculation:', error);
    throw new Error('Failed to compute overall sentiment');
  }
}

module.exports = { predictSentiment, overallSentiment };
