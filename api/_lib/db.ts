import { kv } from '@vercel/kv';
import { Survey, SurveyStats } from './types';

const SURVEYS_KEY = 'surveys';
const SURVEY_IDS_KEY = 'survey_ids';

// 모든 설문 ID 목록 가져오기
export async function getSurveyIds(): Promise<string[]> {
  const ids = await kv.lrange(SURVEY_IDS_KEY, 0, -1);
  return ids || [];
}

// 모든 설문 가져오기
export async function getAllSurveys(status?: string): Promise<Survey[]> {
  const ids = await getSurveyIds();
  if (ids.length === 0) return [];

  const surveys: Survey[] = [];
  for (const id of ids) {
    const survey = await kv.get<Survey>(`${SURVEYS_KEY}:${id}`);
    if (survey) {
      if (!status || survey.status === status) {
        surveys.push(survey);
      }
    }
  }

  // 최신순 정렬
  return surveys.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// 단일 설문 가져오기
export async function getSurvey(id: string): Promise<Survey | null> {
  return await kv.get<Survey>(`${SURVEYS_KEY}:${id}`);
}

// 설문 생성
export async function createSurvey(survey: Survey): Promise<void> {
  await kv.set(`${SURVEYS_KEY}:${survey.id}`, survey);
  await kv.lpush(SURVEY_IDS_KEY, survey.id);
}

// 설문 업데이트
export async function updateSurvey(id: string, updates: Partial<Survey>): Promise<Survey | null> {
  const survey = await getSurvey(id);
  if (!survey) return null;

  const updatedSurvey = { ...survey, ...updates };
  await kv.set(`${SURVEYS_KEY}:${id}`, updatedSurvey);
  return updatedSurvey;
}

// 설문 삭제
export async function deleteSurvey(id: string): Promise<boolean> {
  const survey = await getSurvey(id);
  if (!survey) return false;

  await kv.del(`${SURVEYS_KEY}:${id}`);
  await kv.lrem(SURVEY_IDS_KEY, 1, id);
  return true;
}

// 통계 가져오기
export async function getStats(): Promise<SurveyStats> {
  const surveys = await getAllSurveys();

  const stats: SurveyStats = {
    total: surveys.length,
    pending: 0,
    approved: 0,
    rejected: 0,
    totalRevenue: 0,
  };

  for (const survey of surveys) {
    if (survey.status === 'pending') stats.pending++;
    else if (survey.status === 'approved') {
      stats.approved++;
      stats.totalRevenue += survey.totalPrice || 0;
    }
    else if (survey.status === 'rejected') stats.rejected++;
  }

  return stats;
}
