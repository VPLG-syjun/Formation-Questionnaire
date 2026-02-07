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
      const { action, id, customerInfo, answers, totalPrice, completedSectionIndex, email } = req.body;

      // 자동 저장
      if (action === 'autosave') {
        console.log('[AutoSave] Request:', { id, email: customerInfo?.email, completedSectionIndex });

        if (id) {
          const existingSurveyStr = await client.hGet('surveys', id);
          if (existingSurveyStr) {
            const existingSurvey = JSON.parse(existingSurveyStr);
            if (existingSurvey.status !== 'in_progress') {
              return res.status(400).json({ error: '이미 제출된 설문은 수정할 수 없습니다.', id: existingSurvey.id });
            }
            const updatedSurvey = { ...existingSurvey, customerInfo, answers, totalPrice, completedSectionIndex, updatedAt: new Date().toISOString() };
            await client.hSet('surveys', id, JSON.stringify(updatedSurvey));
            return res.status(200).json({ id, message: '설문이 자동 저장되었습니다.', isNew: false });
          }
        }

        const newId = id || uuidv4();
        const survey = { id: newId, customerInfo, answers, totalPrice, status: 'in_progress', completedSectionIndex, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        await client.hSet('surveys', newId, JSON.stringify(survey));
        return res.status(201).json({ id: newId, message: '설문이 자동 저장되었습니다.', isNew: true });
      }

      // 이메일로 작성중인 설문 찾기
      if (action === 'findByEmail') {
        if (!email) {
          return res.status(400).json({ error: '이메일이 필요합니다.' });
        }
        const allSurveys = await client.hGetAll('surveys');
        const surveys = Object.values(allSurveys).map((s) => JSON.parse(s as string));
        const inProgressSurvey = surveys
          .filter((s: any) => s.status === 'in_progress' && s.customerInfo?.email?.toLowerCase() === email.toLowerCase())
          .sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())[0];

        return res.status(200).json({ found: !!inProgressSurvey, survey: inProgressSurvey || null });
      }

      // 기본: 설문 생성/제출
      const existingId = req.body.id;
      if (existingId) {
        const existingSurveyStr = await client.hGet('surveys', existingId);
        if (existingSurveyStr) {
          const existingSurvey = JSON.parse(existingSurveyStr);
          if (existingSurvey.status === 'in_progress') {
            const updatedSurvey = { ...existingSurvey, customerInfo, answers, totalPrice, status: 'pending', completedSectionIndex: undefined, updatedAt: new Date().toISOString() };
            await client.hSet('surveys', existingId, JSON.stringify(updatedSurvey));
            return res.status(200).json({ id: existingId, message: '설문이 성공적으로 제출되었습니다.' });
          }
        }
      }

      const newId = uuidv4();
      const survey = { id: newId, customerInfo, answers, totalPrice, status: 'pending', createdAt: new Date().toISOString() };
      await client.hSet('surveys', newId, JSON.stringify(survey));
      return res.status(201).json({ id: newId, message: '설문이 성공적으로 제출되었습니다.' });
    }

    if (req.method === 'GET') {
      const { status } = req.query;
      const allSurveys = await client.hGetAll('surveys');
      let surveys = Object.values(allSurveys).map((s) => JSON.parse(s as string));

      if (status && status !== 'all') {
        surveys = surveys.filter((s: any) => s.status === status);
      }

      surveys.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return res.status(200).json(surveys);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.', details: error?.message || String(error) });
  } finally {
    if (client) {
      try {
        await client.disconnect();
      } catch (e) {
        console.error('Redis disconnect error:', e);
      }
    }
  }
}
