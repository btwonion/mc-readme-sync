'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const ACTION_NAME = 'mc-readme-sync';
const MODRINTH_API = 'https://api.modrinth.com/v2';
const CURSEFORGE_API = 'https://minecraft.curseforge.com/api';

function getInput(name, options = {}) {
  const key = `INPUT_${name.replace(/ /g, '_').toUpperCase()}`;
  const value = (process.env[key] || '').trim();

  if (options.required && !value) {
    throw new Error(`Input required and not supplied: ${name}`);
  }

  return value;
}

function workflowCommand(command, message) {
  const escaped = String(message)
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A');
  process.stdout.write(`::${command}::${escaped}\n`);
}

function resolveReadmePath(workspace, inputPath) {
  const root = path.resolve(workspace);
  const file = path.resolve(root, inputPath);
  const relative = path.relative(root, file);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`readme-path must point to a file inside ${root}`);
  }

  return file;
}

async function responseError(platform, response) {
  let details = '';

  try {
    details = (await response.text()).trim();
  } catch {
    // The status is still useful when a response body cannot be read.
  }

  const suffix = details ? `: ${details.slice(0, 1000)}` : '';
  return new Error(`${platform} returned HTTP ${response.status}${suffix}`);
}

async function updateCurseForge({ apiKey, projectId, description, fetchImpl = fetch }) {
  if (!/^\d+$/.test(projectId)) {
    throw new Error('curseforge-project-id must be numeric');
  }

  const response = await fetchImpl(
    `${CURSEFORGE_API}/projects/${encodeURIComponent(projectId)}/update-project`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Token': apiKey,
      },
      body: JSON.stringify({
        description,
        descriptionType: 'markdown',
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!response.ok) {
    throw await responseError('CurseForge', response);
  }
}

async function updateModrinth({ apiKey, projectId, description, repository, fetchImpl = fetch }) {
  const userAgent = repository
    ? `${repository}/${ACTION_NAME}`
    : ACTION_NAME;

  const response = await fetchImpl(
    `${MODRINTH_API}/project/${encodeURIComponent(projectId)}`,
    {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        Authorization: apiKey,
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
      },
      body: JSON.stringify({ body: description }),
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!response.ok) {
    throw await responseError('Modrinth', response);
  }
}

async function run() {
  const modrinthApiKey = getInput('modrinth-api-key', { required: true });
  const curseforgeApiKey = getInput('curseforge-api-key', { required: true });
  const modrinthProjectId = getInput('modrinth-project-id', { required: true });
  const curseforgeProjectId = getInput('curseforge-project-id', { required: true });
  const readmePath = getInput('readme-path') || 'README.md';
  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();

  workflowCommand('add-mask', modrinthApiKey);
  workflowCommand('add-mask', curseforgeApiKey);

  const file = resolveReadmePath(workspace, readmePath);
  const description = await fs.readFile(file, 'utf8');

  if (!description.trim()) {
    throw new Error(`${readmePath} is empty`);
  }

  const updates = await Promise.allSettled([
    updateCurseForge({
      apiKey: curseforgeApiKey,
      projectId: curseforgeProjectId,
      description,
    }),
    updateModrinth({
      apiKey: modrinthApiKey,
      projectId: modrinthProjectId,
      description,
      repository: process.env.GITHUB_REPOSITORY,
    }),
  ]);

  const platforms = ['CurseForge', 'Modrinth'];
  const failures = [];

  updates.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      workflowCommand('notice', `${platforms[index]} description updated`);
    } else {
      failures.push(`${platforms[index]}: ${result.reason.message}`);
    }
  });

  if (failures.length) {
    throw new Error(failures.join('\n'));
  }
}

if (require.main === module) {
  run().catch((error) => {
    workflowCommand('error', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  CURSEFORGE_API,
  MODRINTH_API,
  getInput,
  resolveReadmePath,
  updateCurseForge,
  updateModrinth,
};
