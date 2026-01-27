import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSurvey, updateSurvey, deleteSurvey } from '../_lib/db';
import { UpdateSurveyDTO } from '../_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: '유효하지 않은 ID입니다.' });
  }

  try {
    if (req.method === 'GET') {
      // 단일 설문 조회
      const survey = await getSurvey(id);

      if (!survey) {
        return res.status(404).json({ error: '설문을 찾을 수 없습니다.' });
      }

      return res.status(200).json(survey);
    }

    if (req.method === 'PATCH') {
      // 설문 업데이트 (상태 변경 등)
      const data: UpdateSurveyDTO = req.body;

      const updates: Partial<typeof data & { reviewedAt?: string }> = {};

      if (data.status) {
        updates.status = data.status;
        updates.reviewedAt = new Date().toISOString();
      }

      if (data.adminNotes !== undefined) {
        updates.adminNotes = data.adminNotes;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: '업데이트할 내용이 없습니다.' });
      }

      const updatedSurvey = await updateSurvey(id, updates);

      if (!updatedSurvey) {
        return res.status(404).json({ error: '설문을 찾을 수 없습니다.' });
      }

      return res.status(200).json({ message: '설문이 업데이트되었습니다.' });
    }

    if (req.method === 'DELETE') {
      // 설문 삭제
      const deleted = await deleteSurvey(id);

      if (!deleted) {
        return res.status(404).json({ error: '설문을 찾을 수 없습니다.' });
      }

      return res.status(200).json({ message: '설문이 삭제되었습니다.' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
