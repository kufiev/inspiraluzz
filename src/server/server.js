require('dotenv').config();

const Hapi = require('@hapi/hapi');
const cron = require('node-cron');

const routes = require('../server/routes');
const { checkScheduledDrafts } = require('../services/scheduleService');

(async () => {
  const server = Hapi.server({
    port: {backend_url},
    host: '{backend_host}',
    routes: {
      cors: {
        origin: ['*'],
        credentials: true,
        additionalHeaders: ['Authorization', 'Content-Type'],
      },
    },
  });

  await server.register(require('@hapi/cookie'));

  server.state('token', {
    ttl: 60 * 60 * 1000,
    isSecure: true,
    isHttpOnly: true,
    path: '/',
    encoding: 'base64json',
    isSameSite: 'None',
  });

  server.route(routes);

  server.ext('onPreResponse', function (request, h) {
    const response = request.response;

    if (response.isBoom) {
      const newResponse = h.response({
        status: 'fail',
        message: response.message,
      });
      newResponse.code(response.output.statusCode);
      return newResponse;
    }

    return h.continue;
  });

  cron.schedule('* * * * *', async () => {
    try {
      console.log('Running scheduled task check...');
      await checkScheduledDrafts();
    } catch (error) {
      console.error('Error in scheduled task:', error);
    }
  });

  await server.start();
  console.log(`Server start at: ${server.info.uri}`);
})();
