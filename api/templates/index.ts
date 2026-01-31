import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from 'redis';
import { v4 as uuidv4 } from 'uuid';

// Redis 키 접두사
const TEMPLATES_KEY = 'templates';
const TEMPLATE_VARIABLES_KEY = 'template_variables';
const TEMPLATE_RULES_KEY = 'template_rules';

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
      // 템플릿 생성
      const { name, displayName, category, filename, filePath } = req.body;

      if (!name || !displayName || !category || !filename || !filePath) {
        return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      const template = {
        id,
        name,
        displayName,
        category,
        filename,
        filePath,
        uploadedAt: now,
        updatedAt: now,
        isActive: true,
      };

      await client.hSet(TEMPLATES_KEY, id, JSON.stringify(template));

      return res.status(201).json({ id, message: '템플릿이 생성되었습니다.', template });
    }

    if (req.method === 'GET') {
      // 템플릿 목록 조회
      const { category, active } = req.query;
      const allTemplates = await client.hGetAll(TEMPLATES_KEY);

      let templates = Object.values(allTemplates).map((t) => JSON.parse(t));

      // 카테고리 필터
      if (category) {
        templates = templates.filter((t) => t.category === category);
      }

      // 활성화 상태 필터
      if (active !== undefined) {
        const isActive = active === 'true';
        templates = templates.filter((t) => t.isActive === isActive);
      }

      // 이름순 정렬
      templates.sort((a, b) => a.name.localeCompare(b.name));

      return res.status(200).json(templates);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Templates API Error:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  } finally {
    if (client) await client.disconnect();
  }
}
