import { beforeEach, describe, expect, it } from 'vitest';
import { api, createUser, resetDb } from './helpers.js';

const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d5a3b40000000049454e44ae426082',
  'hex',
);

describe('uploads', () => {
  beforeEach(resetDb);

  it('accepts a real PNG and returns a safe random filename', async () => {
    const { auth } = await createUser();
    const res = await api().post('/api/uploads').set(auth).attach('file', PNG, { filename: '../../evil name.png', contentType: 'image/png' }).expect(201);
    expect(res.body.url).toMatch(/^\/uploads\/[a-f0-9]{32}\.png$/);
  });

  it('rejects executables, spoofed MIME types and SVG', async () => {
    const { auth } = await createUser();
    await api().post('/api/uploads').set(auth).attach('file', Buffer.from('MZ....'), { filename: 'virus.exe', contentType: 'image/png' }).expect(400);
    await api().post('/api/uploads').set(auth).attach('file', Buffer.from('<?php echo 1;'), { filename: 'a.png', contentType: 'image/png' }).expect(400);
    await api().post('/api/uploads').set(auth).attach('file', Buffer.from('<svg/>'), { filename: 'a.svg', contentType: 'image/svg+xml' }).expect(400);
  });

  it('requires authentication', async () => {
    await api().post('/api/uploads').attach('file', PNG, { filename: 'a.png', contentType: 'image/png' }).expect(401);
  });
});
