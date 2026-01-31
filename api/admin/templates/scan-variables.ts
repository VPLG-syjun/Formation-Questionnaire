import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from 'redis';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

const TEMPLATE_FILES_KEY = 'template_files';

async function getRedisClient() {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  return client;
}

// docxtemplater에서 변수를 추출하는 함수
function extractVariables(doc: Docxtemplater): string[] {
  const variables = new Set<string>();

  // IntrospectionModule을 사용하여 태그 추출
  const tags = doc.getFullText();

  // {변수명} 패턴을 정규식으로 찾기
  const regex = /\{([^{}]+)\}/g;
  let match;

  while ((match = regex.exec(tags)) !== null) {
    const varName = match[1].trim();
    // 조건문이나 루프 태그 제외 (#, /, ^, !)
    if (!varName.startsWith('#') &&
        !varName.startsWith('/') &&
        !varName.startsWith('^') &&
        !varName.startsWith('!')) {
      variables.add(varName);
    }
  }

  return Array.from(variables).sort();
}

// XML에서 직접 변수 추출 (더 정확한 방법)
function extractVariablesFromZip(zip: PizZip): string[] {
  const variables = new Set<string>();
  const regex = /\{([^{}]+)\}/g;

  // Word 문서의 주요 XML 파일들을 검사
  const xmlFiles = [
    'word/document.xml',
    'word/header1.xml',
    'word/header2.xml',
    'word/header3.xml',
    'word/footer1.xml',
    'word/footer2.xml',
    'word/footer3.xml',
  ];

  for (const filename of xmlFiles) {
    try {
      const file = zip.file(filename);
      if (file) {
        const content = file.asText();
        let match;
        while ((match = regex.exec(content)) !== null) {
          const varName = match[1].trim();
          // 조건문이나 루프 태그 제외
          if (!varName.startsWith('#') &&
              !varName.startsWith('/') &&
              !varName.startsWith('^') &&
              !varName.startsWith('!')) {
            variables.add(varName);
          }
        }
      }
    } catch {
      // 파일이 없으면 무시
    }
  }

  return Array.from(variables).sort();
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

  const { templateId } = req.body;

  if (!templateId) {
    return res.status(400).json({ error: 'templateId가 필요합니다.' });
  }

  let client;
  try {
    client = await getRedisClient();

    // 템플릿 파일 데이터 조회
    const fileData = await client.hGet(TEMPLATE_FILES_KEY, templateId);
    if (!fileData) {
      return res.status(404).json({ error: '템플릿 파일을 찾을 수 없습니다.' });
    }

    // Base64 디코딩
    const buffer = Buffer.from(fileData, 'base64');

    // PizZip으로 DOCX 파일 열기
    const zip = new PizZip(buffer);

    // docxtemplater 인스턴스 생성
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{', end: '}' },
    });

    // 두 가지 방법으로 변수 추출
    const varsFromDoc = extractVariables(doc);
    const varsFromZip = extractVariablesFromZip(zip);

    // 두 결과 병합
    const allVariables = Array.from(new Set([...varsFromDoc, ...varsFromZip])).sort();

    return res.status(200).json({
      variables: allVariables,
      count: allVariables.length,
      templateId,
    });
  } catch (error) {
    console.error('Variable Scan Error:', error);
    return res.status(500).json({
      error: '변수 스캔 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    if (client) await client.disconnect();
  }
}
