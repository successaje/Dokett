'use strict';

const http = require('node:http');

/**
 * The Lens HTTP API.
 *
 * Free, unauthenticated, CORS-open, and read-only. That is a strategic choice
 * rather than an unfinished one: a registry is worth what its coverage is worth,
 * and coverage comes from venues integrating the read path. Charging at the door
 * would trade the network effect for rounding-error revenue. The paid tier is the
 * aggregate institutional product — concentration, correlation, portfolio
 * exposure — not the per-obligation lookup that makes registering worthwhile.
 *
 * Written on node:http with no framework so it runs from a clean checkout.
 */
function createServer(index, log = console) {
  const routes = [
    [/^\/health$/, () => ({ ok: true, asOfBlock: index.lastBlock, obligations: index.obligations.size })],
    [/^\/solvency\/(0x[0-9a-fA-F]{40}|0x[0-9a-fA-F]{64})$/, (m) => index.solvency(m[1])],
    [/^\/encumbrance\/(0x[0-9a-fA-F]{40}|0x[0-9a-fA-F]{64})$/, (m) => index.encumbrance(m[1])],
    [/^\/obligation\/(\d+)$/, (m) => index.obligation(m[1])],
    [/^\/underwriter\/(0x[0-9a-fA-F]{40})$/, (m) => index.underwriter(m[1])],
    [/^\/obligations$/, () => ({ asOfBlock: index.lastBlock, obligations: [...index.obligations.values()] })],
  ];

  return http.createServer((req, res) => {
    const send = (code, body) => {
      const payload = JSON.stringify(body, null, 2);
      res.writeHead(code, {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'cache-control': 'no-store',
      });
      res.end(payload);
    };

    if (req.method === 'OPTIONS') return send(204, {});
    if (req.method !== 'GET') return send(405, { error: 'read-only: GET only' });

    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

    for (const [pattern, handler] of routes) {
      const m = path.match(pattern);
      if (!m) continue;
      try {
        const body = handler(m);
        return body == null ? send(404, { error: 'not found', path }) : send(200, body);
      } catch (err) {
        log.error(`[api] ${path}: ${err.message}`);
        return send(500, { error: err.message });
      }
    }

    send(404, {
      error: 'not found',
      endpoints: [
        'GET /health',
        'GET /solvency/:entity      — what does this counterparty already owe?',
        'GET /encumbrance/:asset    — is this collateral already pledged?',
        'GET /obligation/:id',
        'GET /underwriter/:address',
        'GET /obligations',
      ],
    });
  });
}

module.exports = { createServer };
