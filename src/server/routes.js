const {
  registerHandler,
  loginHandler,
  verifyTokenHandler,
  logoutHandler,
  updateUserHandler,
  updateUserTokenHandler,
} = require('./handlers/userHandler');
const { getTopicHandler } = require('./handlers/topicHandler');
const {
  postDraftContentHandler,
  getDraftContentHandler,
  updateDraftContentHandler,
  deleteDraftContentHandler,
} = require('./handlers/draftHandler');
const {
  postScheduledDraftContentHandler,
  getScheduledDraftContentHandler,
  updateScheduledDraftContentHandler,
  deleteScheduledDraftContentHandler,
} = require('./handlers/scheduledDraftHandler');
const {
  newChatHandler,
  chatHandler,
  deleteChatHandler,
  getChatHandler,
} = require('./handlers/chatHandler');

const routes = [
  //user
  {
    path: '/users',
    method: 'POST',
    handler: registerHandler,
  },
  {
    path: '/login',
    method: 'POST',
    handler: loginHandler,
  },
  {
    path: '/verify',
    method: 'GET',
    handler: verifyTokenHandler,
  },
  {
    path: '/logout',
    method: 'POST',
    handler: logoutHandler,
  },
  {
    path: '/update-users',
    method: 'PUT',
    handler: updateUserHandler,
    options: {
      payload: {
        allow: 'application/json',
        parse: true,
      },
    },
  },

  {
    path: '/updateUserToken',
    method: 'GET',
    handler: updateUserTokenHandler,
  },

  //topic
  {
    path: '/topics',
    method: 'GET',
    handler: getTopicHandler,
  },

  //draft
  {
    path: '/drafts',
    method: 'POST',
    handler: postDraftContentHandler,
  },
  {
    method: 'PUT',
    path: '/drafts/{draftId}', // Updated route to include draftId as a parameter
    handler: updateDraftContentHandler,
  },
  {
    method: 'GET',
    path: '/drafts',
    handler: getDraftContentHandler,
  },
  {
    method: 'DELETE',
    path: '/drafts/{draftId}', // Delete specific draft
    handler: deleteDraftContentHandler,
  },

  //scheduled draft
  {
    path: '/scheduledPosts',
    method: 'POST',
    handler: postScheduledDraftContentHandler,
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
    path: '/scheduledPosts',
    method: 'GET',
    handler: getScheduledDraftContentHandler,
  },
  {
    method: 'PUT',
    path: '/scheduledPosts/{draftId}',
    handler: updateScheduledDraftContentHandler,
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
    method: 'DELETE',
    path: '/scheduledPosts/{draftId}',
    handler: deleteScheduledDraftContentHandler,
  },

  //chat
  {
    path: '/chats',
    method: 'POST',
    handler: newChatHandler,
  },
  {
    path: '/chats/{chatId}',
    method: 'POST',
    handler: chatHandler,
  },
  {
    path: '/chats/{chatId}',
    method: 'DELETE',
    handler: deleteChatHandler,
  },
  {
    path: '/chats',
    method: 'GET',
    handler: getChatHandler,
  },
];

module.exports = routes;
