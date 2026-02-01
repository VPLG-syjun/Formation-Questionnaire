import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from 'redis';
import { v4 as uuidv4 } from 'uuid';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import * as Archiver from 'archiver';
import { PassThrough } from 'stream';
import {
  transformSurveyToVariables,
  validateVariables,
  SurveyResponse,
  VariableMapping,
} from '../../lib/document-generator.js';

// Redis Keys
const SURVEYS_KEY = 'surveys';
const TEMPLATES_KEY = 'templates';
const TEMPLATE_FILES_KEY = 'template_files';
const TEMPLATE_VARIABLES_KEY = 'template_variables';
const GENERATED_DOCS_KEY = 'generated_documents';
const TEMP_FILES_KEY = 'temp_files';

// 24시간 TTL for temporary files
const TEMP_FILE_TTL = 60 * 60 * 24;

interface GenerateRequest {
  surveyId: string;
  selectedTemplates: string[];
  overrideVariables?: Record<string, string>;
}

interface DocumentResult {
  templateId: string;
  templateName: string;
  filename: string;
  status: 'success' | 'error';
  error?: string;
  missingVariables?: string[];
}

interface GenerationRecord {
  id: string;
  surveyId: string;
  templates: DocumentResult[];
  zipFilename: string;
  downloadId: string;
  generatedAt: string;
  generatedBy?: string;
}

async function getRedisClient() {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  return client;
}

/**
 * 문서 파일명 생성
 */
function generateFilename(templateName: string, companyName: string): string {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;

  // 파일명에 사용할 수 없는 문자 제거
  const safeName = (companyName || 'Document').replace(/[<>:"/\\|?*]/g, '_').trim();
  const safeTemplateName = templateName.replace(/[<>:"/\\|?*]/g, '_').trim();

  return `${safeTemplateName}_${safeName}_${dateStr}.docx`;
}

/**
 * ZIP 파일명 생성
 */
function generateZipFilename(companyName: string): string {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;

  const safeName = (companyName || 'Documents').replace(/[<>:"/\\|?*]/g, '_').trim();

  return `${safeName}_Legal_Documents_${dateStr}.zip`;
}

/**
 * docxtemplater로 문서 생성
 */
function generateDocument(
  templateBuffer: Buffer,
  variables: Record<string, string>
): Buffer {
  const zip = new PizZip(templateBuffer);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{', end: '}' },
  });

  doc.render(variables);

  return doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });
}

/**
 * 버퍼들을 ZIP으로 압축
 */
async function createZipBuffer(
  files: Array<{ filename: string; buffer: Buffer }>
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    const passThrough = new PassThrough();

    passThrough.on('data', (chunk: Buffer) => chunks.push(new Uint8Array(chunk)));
    passThrough.on('end', () => resolve(Buffer.concat(chunks)));
    passThrough.on('error', reject);

    const archive = Archiver.default('zip', { zlib: { level: 9 } });
    archive.on('error', reject);
    archive.pipe(passThrough);

    for (const file of files) {
      archive.append(file.buffer, { name: file.filename });
    }

    archive.finalize();
  });
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
    client = await getRedisClient();

    const { surveyId, selectedTemplates, overrideVariables = {} } = req.body as GenerateRequest;

    // 1. 입력 검증
    if (!surveyId) {
      return res.status(400).json({ error: 'surveyId is required' });
    }

    if (!selectedTemplates || !Array.isArray(selectedTemplates) || selectedTemplates.length === 0) {
      return res.status(400).json({ error: 'selectedTemplates must be a non-empty array' });
    }

    // 2. 설문 데이터 조회
    const surveyData = await client.hGet(SURVEYS_KEY, surveyId);
    if (!surveyData) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    const survey = JSON.parse(surveyData);

    // 설문 답변을 SurveyResponse 형식으로 변환
    const responses: SurveyResponse[] = survey.answers || [];

    // 고객 정보도 응답에 추가 (변수로 사용 가능하도록)
    if (survey.customerInfo) {
      if (survey.customerInfo.name) {
        responses.push({ questionId: '__customerName', value: survey.customerInfo.name });
      }
      if (survey.customerInfo.email) {
        responses.push({ questionId: '__customerEmail', value: survey.customerInfo.email });
      }
      if (survey.customerInfo.phone) {
        responses.push({ questionId: '__customerPhone', value: survey.customerInfo.phone });
      }
      if (survey.customerInfo.company) {
        responses.push({ questionId: '__customerCompany', value: survey.customerInfo.company });
      }
    }

    // 관리자가 설정한 날짜 추가 (COIDate, SIGNDate)
    if (survey.adminDates) {
      if (survey.adminDates.COIDate) {
        responses.push({ questionId: '__COIDate', value: survey.adminDates.COIDate });
      }
      if (survey.adminDates.SIGNDate) {
        responses.push({ questionId: '__SIGNDate', value: survey.adminDates.SIGNDate });
      }
    }

    // 관리자가 설정한 값 추가 (Authorized Shares, Par Value, Fair Market Value)
    if (survey.adminValues) {
      if (survey.adminValues.authorizedShares) {
        responses.push({ questionId: '__authorizedShares', value: survey.adminValues.authorizedShares });
      }
      if (survey.adminValues.parValue) {
        responses.push({ questionId: '__parValue', value: survey.adminValues.parValue });
      }
      if (survey.adminValues.fairMarketValue) {
        responses.push({ questionId: '__fairMarketValue', value: survey.adminValues.fairMarketValue });
      }
    }

    // 회사명 추출 (ZIP 파일명용)
    const companyNameResponse = responses.find(r => r.questionId === 'companyName' || r.questionId === 'companyName1');
    const companyNameValue = companyNameResponse?.value;
    const companyName: string = survey.customerInfo?.company ||
                        (Array.isArray(companyNameValue) ? companyNameValue[0] : companyNameValue) ||
                        'Company';

    // 3. 각 템플릿 처리
    const documentResults: DocumentResult[] = [];
    const generatedFiles: Array<{ filename: string; buffer: Buffer }> = [];

    for (const templateId of selectedTemplates) {
      try {
        // 3a. 템플릿 메타데이터 조회
        const templateData = await client.hGet(TEMPLATES_KEY, templateId);
        if (!templateData) {
          documentResults.push({
            templateId,
            templateName: 'Unknown',
            filename: '',
            status: 'error',
            error: 'Template not found',
          });
          continue;
        }

        const template = JSON.parse(templateData);

        // 3b. 템플릿 파일 조회
        const fileData = await client.hGet(TEMPLATE_FILES_KEY, templateId);
        if (!fileData) {
          documentResults.push({
            templateId,
            templateName: template.displayName || template.name,
            filename: '',
            status: 'error',
            error: 'Template file not found',
          });
          continue;
        }

        const templateBuffer = Buffer.from(fileData, 'base64');

        // 3c. 변수 매핑 정보 조회
        const allVariables = await client.hGetAll(TEMPLATE_VARIABLES_KEY);
        const variableMappings: VariableMapping[] = Object.values(allVariables)
          .map(v => JSON.parse(v as string))
          .filter(v => v.templateId === templateId);

        // 3d. 설문 답변 → 변수 변환
        let variables = transformSurveyToVariables(responses, variableMappings);

        // 3e. overrideVariables 적용 (우선순위 높음)
        variables = { ...variables, ...overrideVariables };

        // 3f. 필수 변수 검증
        const validation = validateVariables(variables, variableMappings);

        if (!validation.isValid) {
          // 경고하지만 계속 진행 (빈 값으로 처리됨)
          console.warn(`Template ${templateId} has missing/empty variables:`, {
            missing: validation.missingVariables,
            emptyRequired: validation.emptyRequired,
          });
        }

        // 3g. docxtemplater로 문서 생성
        const generatedBuffer = generateDocument(templateBuffer, variables);

        // 3h. 파일명 생성 및 저장
        const filename = generateFilename(
          template.displayName || template.name,
          companyName
        );

        generatedFiles.push({ filename, buffer: generatedBuffer });

        documentResults.push({
          templateId,
          templateName: template.displayName || template.name,
          filename,
          status: 'success',
          missingVariables: validation.isValid ? undefined : [...validation.missingVariables, ...validation.emptyRequired],
        });

      } catch (docError: any) {
        console.error(`Error generating document for template ${templateId}:`, docError);

        // 템플릿 정보 재조회 시도
        let templateName = 'Unknown';
        try {
          const td = await client.hGet(TEMPLATES_KEY, templateId);
          if (td) {
            const t = JSON.parse(td);
            templateName = t.displayName || t.name;
          }
        } catch {}

        documentResults.push({
          templateId,
          templateName,
          filename: '',
          status: 'error',
          error: docError.message || 'Document generation failed',
        });
      }
    }

    // 4. 성공한 문서가 없으면 에러
    const successfulDocs = documentResults.filter(d => d.status === 'success');
    if (successfulDocs.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No documents were generated successfully',
        documents: documentResults,
      });
    }

    // 5. ZIP 파일 생성
    const zipFilename = generateZipFilename(companyName);
    const zipBuffer = await createZipBuffer(generatedFiles);
    const zipBase64 = zipBuffer.toString('base64');

    // 6. 임시 파일로 저장 (TTL 24시간)
    const downloadId = uuidv4();
    await client.hSet(TEMP_FILES_KEY, downloadId, JSON.stringify({
      filename: zipFilename,
      data: zipBase64,
      mimeType: 'application/zip',
      createdAt: new Date().toISOString(),
    }));
    await client.expire(TEMP_FILES_KEY, TEMP_FILE_TTL);

    // 7. 생성 기록 저장
    const recordId = uuidv4();
    const generationRecord: GenerationRecord = {
      id: recordId,
      surveyId,
      templates: documentResults,
      zipFilename,
      downloadId,
      generatedAt: new Date().toISOString(),
    };

    await client.hSet(GENERATED_DOCS_KEY, recordId, JSON.stringify(generationRecord));

    // 8. 설문 상태 업데이트
    survey.documentGeneratedAt = new Date().toISOString();
    survey.lastGenerationId = recordId;
    await client.hSet(SURVEYS_KEY, surveyId, JSON.stringify(survey));

    // 9. 응답 반환
    return res.status(200).json({
      success: true,
      documents: documentResults,
      zipFile: zipFilename,
      downloadUrl: `/api/admin/download/${downloadId}`,
      generationId: recordId,
      stats: {
        total: selectedTemplates.length,
        successful: successfulDocs.length,
        failed: documentResults.filter(d => d.status === 'error').length,
      },
    });

  } catch (error: any) {
    console.error('Generate Documents API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error occurred',
      details: error.message,
    });
  } finally {
    if (client) await client.disconnect();
  }
}
