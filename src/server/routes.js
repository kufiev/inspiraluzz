const {
  registerHandler,
  loginHandler,
  postPredictHandler,
  postOverallSentimentHandler,
  getOverallSentimentHandler,
  postDraftContentHandler,
  getDraftContentHandler
} = require('../server/handler');

const routes = [
  {
    path: '/register',
    method: 'POST',
    handler: registerHandler,
  },
  {
    path: '/login',
    method: 'POST',
    handler: loginHandler,
  },
  {
    path: '/predict',
    method: 'POST',
    handler: postPredictHandler,
    options: { payload: { allow: 'application/json', parse: true } },
  },
  {
    path: '/predict/overall',
    method: 'POST',
    handler: postOverallSentimentHandler,
    options: { payload: { allow: 'application/json', parse: true } },
  },
  {
    path: '/predict/overall',
    method: 'GET',
    handler: getOverallSentimentHandler,
  },
  {
    path: '/drafts',
    method: 'POST',
    handler: postDraftContentHandler,
    options: {
      payload: {
        output: 'stream',
        allow: 'multipart/form-data',
        parse: true,
        multipart: true,
      },
    },
  },
  {
    path: '/drafts',
    method: 'GET',
    handler: getDraftContentHandler,
  },
];

module.exports = routes;
