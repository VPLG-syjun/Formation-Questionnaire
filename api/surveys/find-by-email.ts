import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from 'redis';

async function getRedisClient() {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  return client;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let client;
  try {
    client = await getRedisClient();

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: '이메일이 필요합니다.' });
    }

    // 모든 설문 조회
    const allSurveys = await client.hGetAll('surveys');
    const surveys = Object.values(allSurveys).map((s) => JSON.parse(s));

    // 해당 이메일로 작성중인 설문 찾기 (가장 최근 것)
    const inProgressSurvey = surveys
      .filter(s =>
        s.status === 'in_progress' &&
        s.customerInfo?.email?.toLowerCase() === email.toLowerCase()
      )
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      [0];

    if (inProgressSurvey) {
      return res.status(200).json({
        found: true,
        survey: inProgressSurvey,
      });
    }

    return res.status(200).json({
      found: false,
      survey: null,
    });
  } catch (error) {
    console.error('Find by email API Error:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  } finally {
    if (client) await client.disconnect();
  }
}
