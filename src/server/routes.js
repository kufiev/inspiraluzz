const {
  registerHandler,
  loginHandler,
  postPredictHandler,
  postOverallSentimentHandler,
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
    options: {
      payload: {
        allow: 'application/json',
        parse: true,
      },
    },
  },
  {
    path: '/predict/overall',
    method: 'POST',
    handler: postOverallSentimentHandler,
    options: {
      payload: {
        allow: 'application/json',
        parse: true,
      },
    },
  },
];

module.exports = routes;
