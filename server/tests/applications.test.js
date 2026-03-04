const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

// Use a temp data directory so tests don't pollute real data
const tmpDir = path.join(require('os').tmpdir(), `leasing-test-${Date.now()}`);
fs.mkdirSync(path.join(tmpDir, 'uploads'), { recursive: true });
fs.mkdirSync(path.join(tmpDir, 'data'), { recursive: true });

// Override the directories before requiring the app
process.env.DATA_DIR = path.join(tmpDir, 'data');
process.env.UPLOADS_DIR = path.join(tmpDir, 'uploads');

// Simple helper to make HTTP requests
function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 5001,
      path: urlPath,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

let server;

before(async () => {
  // Start a fresh server on a different port
  const app = require('../index');
  server = http.createServer(app);
  await new Promise((res) => server.listen(5001, res));
});

after(async () => {
  await new Promise((res, rej) => server.close((e) => e ? rej(e) : res()));
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Applications API', () => {
  let createdId;

  it('GET /api/applications returns empty array initially', async () => {
    const { status, body } = await request('GET', '/api/applications');
    assert.equal(status, 200);
    assert.ok(Array.isArray(body));
  });

  it('POST /api/applications creates a new application', async () => {
    const { status, body } = await request('POST', '/api/applications', {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      phone: '555-1234',
    });
    assert.equal(status, 201);
    assert.ok(body.id);
    assert.equal(body.firstName, 'Jane');
    assert.equal(body.status, 'pending');
    createdId = body.id;
  });

  it('GET /api/applications/:id returns the application', async () => {
    const { status, body } = await request('GET', `/api/applications/${createdId}`);
    assert.equal(status, 200);
    assert.equal(body.id, createdId);
  });

  it('PATCH /api/applications/:id/status updates status', async () => {
    const { status, body } = await request('PATCH', `/api/applications/${createdId}/status`, {
      status: 'approved',
    });
    assert.equal(status, 200);
    assert.equal(body.status, 'approved');
  });

  it('PATCH with invalid status returns 400', async () => {
    const { status } = await request('PATCH', `/api/applications/${createdId}/status`, {
      status: 'invalid_status',
    });
    assert.equal(status, 400);
  });

  it('GET /api/applications/:id returns 404 for unknown id', async () => {
    const { status } = await request('GET', '/api/applications/nonexistent-id');
    assert.equal(status, 404);
  });
});
