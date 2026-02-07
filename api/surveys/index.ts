import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from 'redis';
import { v4 as uuidv4 } from 'uuid';

async function getRedisClient() {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  return client;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let client;
  try {
    client = await getRedisClient();

    if (req.method === 'POST') {
      // 설문 생성 또는 작성중 설문 제출
      const { id: existingId, customerInfo, answers, totalPrice } = req.body;

      // 기존 작성중 설문이 있으면 상태를 pending으로 변경
      if (existingId) {
        const existingSurveyStr = await client.hGet('surveys', existingId);
        if (existingSurveyStr) {
          const existingSurvey = JSON.parse(existingSurveyStr);
          if (existingSurvey.status === 'in_progress') {
            const updatedSurvey = {
              ...existingSurvey,
              customerInfo,
              answers,
              totalPrice,
              status: 'pending',
              completedSectionIndex: undefined,  // 제출 완료 시 제거
              updatedAt: new Date().toISOString(),
            };
            await client.hSet('surveys', existingId, JSON.stringify(updatedSurvey));
            return res.status(200).json({ id: existingId, message: '설문이 성공적으로 제출되었습니다.' });
          }
        }
      }

      // 새 설문 생성
      const id = uuidv4();
      const survey = {
        id,
        customerInfo,
        answers,
        totalPrice,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      await client.hSet('surveys', id, JSON.stringify(survey));

      return res.status(201).json({ id, message: '설문이 성공적으로 제출되었습니다.' });
    }

    if (req.method === 'GET') {
      // 설문 목록 조회
      const { status } = req.query;
      const allSurveys = await client.hGetAll('surveys');

      let surveys = Object.values(allSurveys).map((s) => JSON.parse(s));

      if (status && status !== 'all') {
        surveys = surveys.filter((s) => s.status === status);
      }

      // 최신순 정렬
      surveys.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return res.status(200).json(surveys);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  } finally {
    if (client) await client.disconnect();
  }
}
