import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import { getAllSurveys, createSurvey } from '../_lib/db';
import { Survey, CreateSurveyDTO } from '../_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // 설문 목록 조회
      const status = req.query.status as string | undefined;
      const surveys = await getAllSurveys(status);
      return res.status(200).json(surveys);
    }

    if (req.method === 'POST') {
      // 설문 생성
      const data: CreateSurveyDTO = req.body;

      // Validation
      if (!data.customerInfo || !data.customerInfo.email || !data.answers) {
        return res.status(400).json({ error: '필수 항목을 입력해주세요.' });
      }

      const survey: Survey = {
        id: uuidv4(),
        customerInfo: data.customerInfo,
        answers: data.answers,
        totalPrice: data.totalPrice || 0,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      await createSurvey(survey);

      return res.status(201).json({
        id: survey.id,
        message: '설문이 성공적으로 제출되었습니다.',
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
