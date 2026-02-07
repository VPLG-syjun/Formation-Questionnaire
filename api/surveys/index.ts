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
      const { action } = req.body;

      // 자동 저장
      if (action === 'autosave') {
        return handleAutosave(client, req, res);
      }

      // 이메일로 작성중인 설문 찾기
      if (action === 'findByEmail') {
        return handleFindByEmail(client, req, res);
      }

      // 기본: 설문 생성/제출
      return handleCreateSurvey(client, req, res);
    }

    if (req.method === 'GET') {
      // 설문 목록 조회
      const { status } = req.query;
      const allSurveys = await client.hGetAll('surveys');

      let surveys = Object.values(allSurveys).map((s) => JSON.parse(s as string));

      if (status && status !== 'all') {
        surveys = surveys.filter((s) => s.status === status);
      }

      // 최신순 정렬
      surveys.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return res.status(200).json(surveys);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({
      error: '서버 오류가 발생했습니다.',
      details: error?.message || String(error)
    });
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

// 설문 생성/제출 핸들러
async function handleCreateSurvey(
  client: any,
  req: VercelRequest,
  res: VercelResponse
) {
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
          completedSectionIndex: undefined,
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

// 자동 저장 핸들러
async function handleAutosave(
  client: any,
  req: VercelRequest,
  res: VercelResponse
) {
  const { id, customerInfo, answers, totalPrice, completedSectionIndex } = req.body;
  console.log('[AutoSave API] Request received:', { id, email: customerInfo?.email, completedSectionIndex });

  // 기존 설문 ID가 있으면 업데이트
  if (id) {
    const existingSurveyStr = await client.hGet('surveys', id);

    if (existingSurveyStr) {
      const existingSurvey = JSON.parse(existingSurveyStr);

      // 이미 제출된 설문이면 업데이트 불가
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
}

// 이메일로 작성중인 설문 찾기 핸들러
async function handleFindByEmail(
  client: any,
  req: VercelRequest,
  res: VercelResponse
) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: '이메일이 필요합니다.' });
  }

  // 모든 설문 조회
  const allSurveys = await client.hGetAll('surveys');
  const surveys = Object.values(allSurveys).map((s) => JSON.parse(s as string));

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
}
