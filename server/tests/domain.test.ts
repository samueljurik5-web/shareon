import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { env } from '../src/config/env.js';
import { createApp } from '../src/app.js';

describe('own domain redirect', () => {
  const saved = env.PUBLIC_APP_URL;
  afterEach(() => {
    env.PUBLIC_APP_URL = saved;
  });

  it('redirects *.onrender.com to PUBLIC_APP_URL, keeps the health check and other hosts', async () => {
    env.PUBLIC_APP_URL = 'https://shareon.sk';
    const app = createApp();
    const res = await request(app).get('/items/abc?x=1').set('Host', 'shareon-x1.onrender.com').expect(301);
    expect(res.headers.location).toBe('https://shareon.sk/items/abc?x=1');
    await request(app).get('/api/health').set('Host', 'shareon-x1.onrender.com').expect(200);
    await request(app).get('/api/health').set('Host', 'shareon.sk').expect(200);
  });

  it('does nothing without PUBLIC_APP_URL', async () => {
    env.PUBLIC_APP_URL = undefined;
    await request(createApp()).get('/api/health').set('Host', 'shareon-x1.onrender.com').expect(200);
  });
});
