const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');

async function loadModel() {
    const model = await tf.loadLayersModel('file://models/model.json');

    const tokenizerPath = path.join(__dirname, '../../models/sentiment_analysis_tokenizer.json');
    const tokenizerData = fs.readFileSync(tokenizerPath, 'utf-8');

     // Recursive parsing to handle nested JSON strings
    let tokenizer = tokenizerData;

    while (typeof tokenizer === 'string') {
        try {
            tokenizer = JSON.parse(tokenizer);
        } catch (error) {
            console.error('Failed to parse JSON:', error);
            break;
        }
    }

    if (typeof tokenizer !== 'object') {
        throw new Error('Tokenizer is not a valid object after parsing.');
    }

    const fieldsToParse = ['word_counts', 'word_docs', 'index_docs', 'index_word', 'word_index'];

    fieldsToParse.forEach((field) => {
        if (typeof tokenizer.config?.[field] === 'string') {
            try {
                tokenizer.config[field] = JSON.parse(tokenizer.config[field]);
            } catch (error) {
                console.error(`Failed to parse ${field}:`, error);
                throw new Error(`Invalid ${field} format in tokenizer config.`);
            }
        }
    });

    tokenizer = tokenizer.config.word_index;
    return { model, tokenizer };
}

module.exports = loadModel;
