import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from 'redis';
import PizZip from 'pizzip';

const TEMPLATE_FILES_KEY = 'template_files';

async function getRedisClient() {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  return client;
}

/**
 * DOCX 템플릿에서 {변수명} 형식의 변수를 추출
 */
function extractVariablesFromDocx(buffer: Buffer): string[] {
  try {
    const zip = new PizZip(buffer);
    const variables = new Set<string>();

    // DOCX의 주요 XML 파일들을 스캔
    const xmlFiles = [
      'word/document.xml',
      'word/header1.xml',
      'word/header2.xml',
      'word/header3.xml',
      'word/footer1.xml',
      'word/footer2.xml',
      'word/footer3.xml',
    ];

    for (const xmlFile of xmlFiles) {
      try {
        const file = zip.file(xmlFile);
        if (file) {
          const content = file.asText();

          // {변수명} 패턴 찾기 (XML 태그 사이에 분리된 경우도 처리)
          // 먼저 XML 태그를 제거하고 텍스트만 추출
          const textContent = content.replace(/<[^>]+>/g, '');

          // {변수명} 패턴 매칭
          const matches = textContent.match(/\{([^}]+)\}/g);
          if (matches) {
            for (const match of matches) {
              const varName = match.slice(1, -1).trim();
              // 유효한 변수명인지 확인 (영문, 숫자, 언더스코어만)
              if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName)) {
                variables.add(varName);
              }
            }
          }
        }
      } catch {
        // 파일이 없거나 읽기 실패 시 무시
      }
    }

    return Array.from(variables).sort();
  } catch (error) {
    console.error('Error extracting variables:', error);
    return [];
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
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
    const { templateId } = req.body;

    if (!templateId) {
      return res.status(400).json({ error: 'templateId is required' });
    }

    client = await getRedisClient();

    // 템플릿 파일 조회
    const fileData = await client.hGet(TEMPLATE_FILES_KEY, templateId);
    if (!fileData) {
      return res.status(404).json({ error: 'Template file not found' });
    }

    const templateBuffer = Buffer.from(fileData, 'base64');

    // 변수 추출
    const variables = extractVariablesFromDocx(templateBuffer);

    return res.status(200).json({
      templateId,
      variables,
      count: variables.length,
    });

  } catch (error: any) {
    console.error('Scan Variables API Error:', error);
    return res.status(500).json({
      error: 'Server error occurred',
      details: error.message,
    });
  } finally {
    if (client) await client.disconnect();
  }
}
