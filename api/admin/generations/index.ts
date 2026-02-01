import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from 'redis';

const GENERATED_DOCS_KEY = 'generated_documents';
const SURVEYS_KEY = 'surveys';

async function getRedisClient() {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  return client;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
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

    const { surveyId, limit = '50', offset = '0' } = req.query;

    // 모든 생성 기록 조회
    const allRecords = await client.hGetAll(GENERATED_DOCS_KEY);
    let records = Object.values(allRecords).map(r => JSON.parse(r as string));

    // surveyId로 필터링
    if (surveyId && typeof surveyId === 'string') {
      records = records.filter(r => r.surveyId === surveyId);
    }

    // 날짜 내림차순 정렬
    records.sort((a, b) =>
      new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    );

    // 페이지네이션
    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);
    const paginatedRecords = records.slice(offsetNum, offsetNum + limitNum);

    // 각 기록에 설문 정보 추가
    const enrichedRecords = await Promise.all(
      paginatedRecords.map(async (record) => {
        const surveyData = await client.hGet(SURVEYS_KEY, record.surveyId);
        let surveyInfo = null;

        if (surveyData) {
          const survey = JSON.parse(surveyData);
          surveyInfo = {
            customerName: survey.customerInfo?.name,
            customerEmail: survey.customerInfo?.email,
            company: survey.customerInfo?.company,
          };
        }

        return {
          ...record,
          surveyInfo,
        };
      })
    );

    return res.status(200).json({
      records: enrichedRecords,
      total: records.length,
      limit: limitNum,
      offset: offsetNum,
    });

  } catch (error: any) {
    console.error('Generations List API Error:', error);
    return res.status(500).json({
      error: 'Server error occurred',
      details: error.message,
    });
  } finally {
    if (client) await client.disconnect();
  }
}
