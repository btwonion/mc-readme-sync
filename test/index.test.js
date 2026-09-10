'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  CURSEFORGE_API,
  MODRINTH_API,
  resolveReadmePath,
  updateCurseForge,
  updateModrinth,
} = require('../dist/index.js');

function successfulFetch(inspect) {
  return async (url, options) => {
    inspect(url, options);
    return new Response(null, { status: 204 });
  };
}

test('sends the Markdown body to the CurseForge author endpoint', async () => {
  await updateCurseForge({
    apiKey: 'curse-secret',
    projectId: '12345',
    description: '# Hello',
    fetchImpl: successfulFetch((url, options) => {
      assert.equal(url, `${CURSEFORGE_API}/projects/12345/update-project`);
      assert.equal(options.method, 'POST');
      assert.equal(options.headers['X-Api-Token'], 'curse-secret');
      assert.deepEqual(JSON.parse(options.body), {
        description: '# Hello',
        descriptionType: 'markdown',
      });
    }),
  });
});

test('sends the Markdown body to the Modrinth project endpoint', async () => {
  await updateModrinth({
    apiKey: 'modrinth-secret',
    projectId: 'example slug',
    description: '# Hello',
    repository: 'owner/repository',
    fetchImpl: successfulFetch((url, options) => {
      assert.equal(url, `${MODRINTH_API}/project/example%20slug`);
      assert.equal(options.method, 'PATCH');
      assert.equal(options.headers.Authorization, 'modrinth-secret');
      assert.equal(options.headers['User-Agent'], 'owner/repository/mc-readme-sync');
      assert.deepEqual(JSON.parse(options.body), { body: '# Hello' });
    }),
  });
});

test('rejects a non-numeric CurseForge project ID before making a request', async () => {
  await assert.rejects(
    updateCurseForge({
      apiKey: 'secret',
      projectId: 'not-a-number',
      description: '# Hello',
      fetchImpl: () => assert.fail('fetch should not be called'),
    }),
    /must be numeric/,
  );
});

test('rejects a README path outside the workspace', () => {
  assert.throws(
    () => resolveReadmePath('/repo', '../README.md'),
    /must point to a file inside/,
  );
});

test('includes an API response body in an error', async () => {
  await assert.rejects(
    updateModrinth({
      apiKey: 'secret',
      projectId: 'missing',
      description: '# Hello',
      fetchImpl: async () => new Response(
        JSON.stringify({ error: 'not_found' }),
        { status: 404 },
      ),
    }),
    /Modrinth returned HTTP 404.*not_found/,
  );
});
