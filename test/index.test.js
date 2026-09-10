'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  CURSEFORGE_API,
  MODRINTH_API,
  isServiceConfigured,
  resolveReadmePath,
  run,
  updateCurseForge,
  updateModrinth,
} = require('../dist/index.js');

function successfulFetch(inspect) {
  return async (url, options) => {
    inspect(url, options);
    return new Response(null, { status: 204 });
  };
}

async function withInputs(inputs, callback) {
  const inputNames = [
    'modrinth-api-key',
    'curseforge-api-key',
    'modrinth-project-id',
    'curseforge-project-id',
    'readme-path',
  ];
  const entries = inputNames.map((name) => [
    `INPUT_${name.toUpperCase()}`,
    process.env[`INPUT_${name.toUpperCase()}`],
  ]);

  for (const [key] of entries) {
    delete process.env[key];
  }
  for (const [name, value] of Object.entries(inputs)) {
    process.env[`INPUT_${name.toUpperCase()}`] = value;
  }

  try {
    return await callback();
  } finally {
    for (const [key, value] of entries) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('sends the Markdown body as CurseForge multipart metadata', async () => {
  await updateCurseForge({
    apiKey: 'curse-secret',
    projectId: '12345',
    description: '# Hello',
    fetchImpl: successfulFetch((url, options) => {
      assert.equal(url, `${CURSEFORGE_API}/projects/12345/update-project`);
      assert.equal(options.method, 'POST');
      assert.equal(options.headers['X-Api-Token'], 'curse-secret');
      assert.equal(options.headers['Content-Type'], undefined);
      assert.ok(options.body instanceof FormData);
      assert.deepEqual([...options.body.keys()], ['metadata']);
      assert.deepEqual(JSON.parse(options.body.get('metadata')), {
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

test('does nothing when neither service is configured', async () => {
  await withInputs({}, () => run({
    emitCommand: () => {},
    readFile: () => assert.fail('README should not be read'),
    fetchImpl: () => assert.fail('fetch should not be called'),
  }));
});

test('syncs only CurseForge when only CurseForge is configured', async () => {
  let requests = 0;

  await withInputs({
    'curseforge-api-key': 'curse-secret',
    'curseforge-project-id': '12345',
  }, () => run({
    emitCommand: () => {},
    log: () => {},
    readFile: async () => '# CurseForge only',
    fetchImpl: successfulFetch((url) => {
      requests += 1;
      assert.equal(url, `${CURSEFORGE_API}/projects/12345/update-project`);
    }),
  }));

  assert.equal(requests, 1);
});

test('syncs only Modrinth when only Modrinth is configured', async () => {
  let requests = 0;

  await withInputs({
    'modrinth-api-key': 'modrinth-secret',
    'modrinth-project-id': 'example-project',
  }, () => run({
    emitCommand: () => {},
    log: () => {},
    readFile: async () => '# Modrinth only',
    fetchImpl: successfulFetch((url) => {
      requests += 1;
      assert.equal(url, `${MODRINTH_API}/project/example-project`);
    }),
  }));

  assert.equal(requests, 1);
});

test('logs successful updates without creating notice annotations', async () => {
  const commands = [];
  const messages = [];

  await withInputs({
    'modrinth-api-key': 'modrinth-secret',
    'modrinth-project-id': 'example-project',
    'curseforge-api-key': 'curse-secret',
    'curseforge-project-id': '12345',
  }, () => run({
    emitCommand: (command, message) => commands.push([command, message]),
    log: (message) => messages.push(message),
    readFile: async () => '# Both services',
    fetchImpl: successfulFetch(() => {}),
  }));

  assert.deepEqual(messages, [
    'CurseForge description updated',
    'Modrinth description updated',
  ]);
  assert.equal(commands.some(([command]) => command === 'notice'), false);
});

test('rejects a partial service configuration', () => {
  assert.throws(
    () => isServiceConfigured('Modrinth', 'secret', ''),
    /modrinth-project-id is required/,
  );
  assert.throws(
    () => isServiceConfigured('CurseForge', '', '12345'),
    /curseforge-api-key is required/,
  );
});
