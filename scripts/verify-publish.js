#!/usr/bin/env node
/*
  scripts/verify-publish.js

  Verify that a provided GitHub token can commit to the repository by
  creating (then removing) a test post file.

  Usage (locally):
    OAUTH_TEST_TOKEN=ghp_... node scripts/verify-publish.js

  CI: pass `token` as an env var or let the GitHub Actions workflow provide one.
*/

import fs from 'fs';
import path from 'path';

const cfgPath = path.resolve(process.cwd(), 'public', 'admin', 'config.yml');

function readRepoInfo() {
  try {
    const txt = fs.readFileSync(cfgPath, 'utf8');
    const repoMatch = txt.match(/^\s*repo:\s*(?<repo>\S+)/m);
    const branchMatch = txt.match(/^\s*branch:\s*(?<branch>\S+)/m);
    if (!repoMatch) throw new Error('repo not found in ' + cfgPath);
    const repo = repoMatch.groups.repo.trim();
    const [owner, name] = repo.split('/');
    const branch = branchMatch ? branchMatch.groups.branch.trim() : 'main';
    return { owner, name, branch };
  } catch (e) {
    console.error('Error reading config.yml:', e.message);
    process.exitCode = 2;
    throw e;
  }
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { ok: res.ok, status: res.status, body: json };
}

async function run() {
  const token = process.env.OAUTH_TEST_TOKEN || process.env.GITHUB_TOKEN || process.env.TEST_OAUTH_TOKEN;
  if (!token) {
    console.error('Missing token. Set OAUTH_TEST_TOKEN or GITHUB_TOKEN environment variable.');
    process.exit(2);
  }

  const { owner, name, branch } = readRepoInfo();
  const repo = `${owner}/${name}`;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `src/content/posts/verify-publish-${timestamp}.md`;
  const message = `chore: verify publish ${timestamp}`;
  const content = `---\ntitle: Verify Publish ${timestamp}\npublished: ${new Date().toISOString().slice(0,10)}\ndescription: Automated verification file\ndraft: false\n---\n\nThis file was created by scripts/verify-publish.js to verify publish permissions.`;

  console.log('Repo:', repo, 'branch:', branch);
  console.log('Creating test file:', filename);

  const createUrl = `https://api.github.com/repos/${owner}/${name}/contents/${encodeURIComponent(filename)}`;

  const createResp = await fetchJson(createUrl, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'verify-publish-script'
    },
    body: JSON.stringify({ message, content: Buffer.from(content).toString('base64'), branch })
  });

  if (!createResp.ok) {
    console.error('Failed to create file:', createResp.status, createResp.body);
    process.exit(3);
  }

  console.log('File created. Commit SHA:', createResp.body.commit?.sha || createResp.body.commit?.sha);

  // Verify file exists
  const getUrl = createUrl + `?ref=${encodeURIComponent(branch)}`;
  const getResp = await fetchJson(getUrl, {
    headers: { Authorization: `token ${token}`, 'User-Agent': 'verify-publish-script' }
  });
  if (!getResp.ok) {
    console.error('Created file but could not GET it:', getResp.status, getResp.body);
    process.exit(4);
  }

  console.log('Verified file exists in repo. Now removing test file...');

  const sha = getResp.body.sha;
  const deleteResp = await fetchJson(createUrl, {
    method: 'DELETE',
    headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'verify-publish-script' },
    body: JSON.stringify({ message: `chore: cleanup verify publish ${timestamp}`, sha, branch })
  });

  if (!deleteResp.ok) {
    console.error('Failed to delete test file:', deleteResp.status, deleteResp.body);
    process.exit(5);
  }

  console.log('Test file removed. Verify-publish successful.');
}

run().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(2);
});
