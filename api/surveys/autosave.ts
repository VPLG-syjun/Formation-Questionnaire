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

    const { id, customerInfo, answers, totalPrice, completedSectionIndex } = req.body;

    // 기존 설문 ID가 있으면 업데이트, 없으면 새로 생성
    if (id) {
      // 기존 설문 가져오기
      const existingSurveyStr = await client.hGet('surveys', id);

      if (existingSurveyStr) {
        const existingSurvey = JSON.parse(existingSurveyStr);

        // 이미 제출된 설문(pending 이상)이면 업데이트 불가
        if (existingSurvey.status !== 'in_progress') {
          return res.status(400).json({
            error: '이미 제출된 설문은 수정할 수 없습니다.',
            id: existingSurvey.id
          });
        }

        // 기존 설문 업데이트
        const updatedSurvey = {
          ...existingSurvey,
          customerInfo,
          answers,
          totalPrice,
          completedSectionIndex,
          updatedAt: new Date().toISOString(),
        };

        await client.hSet('surveys', id, JSON.stringify(updatedSurvey));

        return res.status(200).json({
          id,
          message: '설문이 자동 저장되었습니다.',
          isNew: false
        });
      }
    }

    // 새 설문 생성
    const newId = id || uuidv4();
    const survey = {
      id: newId,
      customerInfo,
      answers,
      totalPrice,
      status: 'in_progress',
      completedSectionIndex,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await client.hSet('surveys', newId, JSON.stringify(survey));

    return res.status(201).json({
      id: newId,
      message: '설문이 자동 저장되었습니다.',
      isNew: true
    });
  } catch (error) {
    console.error('AutoSave API Error:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  } finally {
    if (client) await client.disconnect();
  }
}
