const tf = require('@tensorflow/tfjs-node');
const _ = require('lodash');

const MAX_LENGTH = 16;
const PADDING_TYPE = 'post';
const TRUNCATING_TYPE = 'post';

function padSequencesJs(
  sequences,
  maxLength,
  padding = 'post',
  truncating = 'post'
) {
  return sequences.map((seq) => {
    if (seq.length > maxLength) {
      return truncating === 'pre'
        ? seq.slice(seq.length - maxLength)
        : seq.slice(0, maxLength);
    } else if (seq.length < maxLength) {
      const paddingArray = new Array(maxLength - seq.length).fill(0);
      return padding === 'pre'
        ? [...paddingArray, ...seq]
        : [...seq, ...paddingArray];
    }
    return seq;
  });
}

async function predictSentiment({ model, tokenizer }, text) {
  try {
    const inputDim = 5000;
    const oovToken = 1;

    const sequences = text.map((t) => {
      return t.split(' ').map((word) => {
        const lowercasedWord = word.toLowerCase();
        const tokenIndex = tokenizer[lowercasedWord] || 0;
        return tokenIndex < inputDim ? tokenIndex : oovToken;
      });
    });

    const paddedSequences = padSequencesJs(
      sequences,
      MAX_LENGTH,
      PADDING_TYPE,
      TRUNCATING_TYPE
    );

    const inputTensor = tf.tensor2d(paddedSequences, [
      paddedSequences.length,
      MAX_LENGTH,
    ]);

    const predictions = model.predict(inputTensor);
    const labels = (await predictions.array()).map((pred) => {
      const maxIndex = _.indexOf(pred, _.max(pred));
      return maxIndex - 1;
    });

    return labels;
  } catch (error) {
    console.error('Error during prediction:', error);
    throw new Error('Failed to predict sentiment');
  }
}

async function overallSentiment({ model, tokenizer }, [summary]) {
  try {
    if (!Array.isArray(summary) || summary.length === 0) {
      throw new Error('Summary must be a non-empty array of strings.');
    }

    summary.forEach((t) => {
      if (typeof t !== 'string') {
        throw new Error('Each item in the summary array must be a string.');
      }
    });

    const inputDim = 5000;
    const oovToken = 1;

    const sequences = summary.map((t) => {
      return t.split(' ').map((word) => {
        const lowercasedWord = word.toLowerCase();
        const tokenIndex = tokenizer[lowercasedWord] || 0;
        return tokenIndex < inputDim ? tokenIndex : oovToken;
      });
    });

    const paddedSequences = padSequencesJs(
      sequences,
      MAX_LENGTH,
      PADDING_TYPE,
      TRUNCATING_TYPE
    );

    const inputTensor = tf.tensor2d(paddedSequences, [
      paddedSequences.length,
      MAX_LENGTH,
    ]);

    const predictions = model.predict(inputTensor);
    const sentiment = (await predictions.array()).map((pred) => {
      const maxIndex = _.indexOf(pred, _.max(pred));
      return maxIndex - 1;
    });

    const sentimentCounts = _.countBy(sentiment);
    const totalCounts = sentiment.length;
    const negativePercentage = (sentimentCounts[-1] || 0) / totalCounts;
    const neutralPercentage = (sentimentCounts[0] || 0) / totalCounts;
    const positivePercentage = (sentimentCounts[1] || 0) / totalCounts;

    return {
      negative: parseFloat(negativePercentage.toFixed(2)),
      neutral: parseFloat(neutralPercentage.toFixed(2)),
      positive: parseFloat(positivePercentage.toFixed(2)),
    };
  } catch (error) {
    console.error('Error during overall sentiment calculation:', error);
    throw new Error('Failed to compute overall sentiment');
  }
}

module.exports = { predictSentiment, overallSentiment };
