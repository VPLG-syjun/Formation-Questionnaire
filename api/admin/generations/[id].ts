import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from 'redis';

const GENERATED_DOCS_KEY = 'generated_documents';
const SURVEYS_KEY = 'surveys';
const TEMPLATES_KEY = 'templates';
const TEMP_FILES_KEY = 'temp_files';

async function getRedisClient() {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  return client;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Generation ID is required' });
  }

  let client;
  try {
    client = await getRedisClient();

    if (req.method === 'GET') {
      // 생성 기록 조회
      const recordData = await client.hGet(GENERATED_DOCS_KEY, id);

      if (!recordData) {
        return res.status(404).json({ error: 'Generation record not found' });
      }

      const record = JSON.parse(recordData);

      // 설문 정보 추가
      const surveyData = await client.hGet(SURVEYS_KEY, record.surveyId);
      let surveyInfo = null;
      if (surveyData) {
        const survey = JSON.parse(surveyData);
        surveyInfo = {
          id: survey.id,
          customerName: survey.customerInfo?.name,
          customerEmail: survey.customerInfo?.email,
          company: survey.customerInfo?.company,
          status: survey.status,
        };
      }

      // 템플릿 추가 정보 조회
      const templatesInfo = await Promise.all(
        record.templates.map(async (doc: any) => {
          const templateData = await client.hGet(TEMPLATES_KEY, doc.templateId);
          let templateInfo = null;
          if (templateData) {
            const template = JSON.parse(templateData);
            templateInfo = {
              category: template.category,
              displayName: template.displayName,
            };
          }
          return {
            ...doc,
            templateInfo,
          };
        })
      );

      // 다운로드 가능 여부 확인
      const downloadAvailable = await client.hExists(TEMP_FILES_KEY, record.downloadId);

      return res.status(200).json({
        ...record,
        templates: templatesInfo,
        surveyInfo,
        downloadAvailable,
        downloadUrl: downloadAvailable ? `/api/admin/download/${record.downloadId}` : null,
      });
    }

    if (req.method === 'DELETE') {
      // 생성 기록 삭제
      const recordData = await client.hGet(GENERATED_DOCS_KEY, id);

      if (!recordData) {
        return res.status(404).json({ error: 'Generation record not found' });
      }

      const record = JSON.parse(recordData);

      // 임시 파일 삭제 (있는 경우)
      if (record.downloadId) {
        await client.hDel(TEMP_FILES_KEY, record.downloadId);
      }

      // 생성 기록 삭제
      await client.hDel(GENERATED_DOCS_KEY, id);

      return res.status(200).json({ message: 'Generation record deleted successfully' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error: any) {
    console.error('Generation Detail API Error:', error);
    return res.status(500).json({
      error: 'Server error occurred',
      details: error.message,
    });
  } finally {
    if (client) await client.disconnect();
  }
}
