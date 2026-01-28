import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from 'redis';

async function getRedisClient() {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  return client;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let client;
  try {
    client = await getRedisClient();

    const allSurveys = await client.hGetAll('surveys');
    const surveys = Object.values(allSurveys).map((s) => JSON.parse(s));

    const stats = {
      total: surveys.length,
      pending: surveys.filter((s) => s.status === 'pending').length,
      approved: surveys.filter((s) => s.status === 'approved').length,
      rejected: surveys.filter((s) => s.status === 'rejected').length,
      totalRevenue: surveys
        .filter((s) => s.status === 'approved')
        .reduce((sum, s) => sum + (s.totalPrice || 0), 0),
    };

    return res.status(200).json(stats);
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  } finally {
    if (client) await client.disconnect();
  }
}
