import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from 'redis';
import { v4 as uuidv4 } from 'uuid';

// Vercel Blob Storage 또는 외부 스토리지 사용 시 여기서 처리
// 현재는 메타데이터만 저장하고 파일은 base64로 Redis에 저장

const TEMPLATES_KEY = 'templates';
const TEMPLATE_FILES_KEY = 'template_files';

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

    const { name, displayName, category, filename, fileData } = req.body;

    // 필수 필드 검증
    if (!name || !displayName || !category || !filename || !fileData) {
      return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
    }

    // 파일 확장자 검증
    if (!filename.toLowerCase().endsWith('.docx')) {
      return res.status(400).json({ error: '.docx 파일만 업로드할 수 있습니다.' });
    }

    // 파일 크기 검증 (base64는 원본의 약 1.37배)
    const maxSizeBase64 = 10 * 1024 * 1024 * 1.37; // 10MB in base64
    if (fileData.length > maxSizeBase64) {
      return res.status(400).json({ error: '파일 크기는 10MB를 초과할 수 없습니다.' });
    }

    const id = uuidv4();
    const timestamp = Date.now();
    const storedFilename = `${timestamp}_${filename}`;
    const now = new Date().toISOString();

    // 템플릿 메타데이터 저장
    const template = {
      id,
      name,
      displayName,
      category,
      filename: storedFilename,
      filePath: `/templates/${storedFilename}`,
      uploadedAt: now,
      updatedAt: now,
      isActive: true,
    };

    await client.hSet(TEMPLATES_KEY, id, JSON.stringify(template));

    // 파일 데이터 저장 (base64)
    await client.hSet(TEMPLATE_FILES_KEY, id, fileData);

    return res.status(201).json({
      id,
      message: '템플릿이 업로드되었습니다.',
      template,
    });
  } catch (error) {
    console.error('Template Upload Error:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  } finally {
    if (client) await client.disconnect();
  }
}
