import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getStats } from '../../_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const stats = await getStats();
    return res.status(200).json(stats);
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: '통계를 불러오는데 실패했습니다.' });
  }
}
