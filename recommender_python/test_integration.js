const assert = require('assert');
const http = require('http');

const recommendationsRouter = require('../routes/recommendations');

async function main() {
  const requestPythonRecommendations = recommendationsRouter.requestPythonRecommendations;
  const previousUrl = process.env.RECOMMENDATION_SERVICE_URL;

  delete process.env.RECOMMENDATION_SERVICE_URL;
  assert.strictEqual(await requestPythonRecommendations({ version: 'v1' }), null);

  const server = http.createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    if (request.url === '/recommend') {
      response.end(JSON.stringify({ version: 'v2.0', recommendations: [], clustering: {} }));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ detail: 'not found' }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  process.env.RECOMMENDATION_SERVICE_URL = `http://127.0.0.1:${address.port}`;
  const result = await requestPythonRecommendations({ version: 'v2.0' });
  assert.strictEqual(result.version, 'v2.0');
  await new Promise((resolve) => server.close(resolve));

  process.env.RECOMMENDATION_SERVICE_URL = 'http://127.0.0.1:1';
  await assert.rejects(() => requestPythonRecommendations({ version: 'v4' }));

  if (previousUrl === undefined) delete process.env.RECOMMENDATION_SERVICE_URL;
  else process.env.RECOMMENDATION_SERVICE_URL = previousUrl;
  console.log('Express-Python bridge checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
