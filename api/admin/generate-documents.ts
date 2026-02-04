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
  repeatForSelections?: Record<string, number[]>;  // 템플릿ID별 선택된 인원 인덱스 (0-based)
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
function generateFilename(templateName: string, companyName: string, personName?: string): string {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;

  // 파일명에 사용할 수 없는 문자 제거
  const safeName = (companyName || 'Document').replace(/[<>:"/\\|?*]/g, '_').trim();
  const safeTemplateName = templateName.replace(/[<>:"/\\|?*]/g, '_').trim();

  // 인원별 문서인 경우 이름 추가
  if (personName) {
    const safePersonName = personName.replace(/[<>:"/\\|?*]/g, '_').trim();
    return `${safeTemplateName}_${safePersonName}_${dateStr}.docx`;
  }

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
 * 설문에서 반복 대상 그룹 데이터 추출
 */
function getRepeatGroupData(
  responses: SurveyResponse[],
  repeatFor: 'founders' | 'directors'
): Array<{ name: string; [key: string]: string }> {
  const groupResponse = responses.find(r => r.questionId === repeatFor);
  if (!groupResponse || !Array.isArray(groupResponse.value)) {
    return [];
  }

  return groupResponse.value.map((item: Record<string, string>) => ({
    name: item.name || item.founderName || item.directorName || 'Unknown',
    ...item,
  }));
}

/**
 * 인원별 변수 생성 (개인 정보로 전역 변수 덮어쓰기)
 */
function createPersonVariables(
  baseVariables: Record<string, string>,
  person: { name: string; [key: string]: string },
  personIndex: number,
  repeatFor: 'founders' | 'directors'
): Record<string, string> {
  const personVars: Record<string, string> = { ...baseVariables };

  // 개인 정보 변수 추가
  if (repeatFor === 'founders') {
    // 창업자별 변수
    personVars['FounderName'] = person.name || '';
    personVars['founderName'] = person.name || '';
    personVars['FounderAddress'] = person.address || person.founderAddress || '';
    personVars['founderAddress'] = person.address || person.founderAddress || '';
    personVars['FounderEmail'] = person.email || person.founderEmail || '';
    personVars['founderEmail'] = person.email || person.founderEmail || '';
    personVars['FounderCash'] = person.cash || person.founderCash || '';
    personVars['founderCash'] = person.cash || person.founderCash || '';

    // 인덱스 변수도 추가 (1-based)
    const idx = personIndex + 1;
    personVars[`Founder${idx}Name`] = person.name || '';
    personVars[`Founder${idx}Address`] = person.address || person.founderAddress || '';
    personVars[`Founder${idx}Email`] = person.email || person.founderEmail || '';
    personVars[`Founder${idx}Cash`] = person.cash || person.founderCash || '';
  } else if (repeatFor === 'directors') {
    // 이사별 변수
    personVars['DirectorName'] = person.name || '';
    personVars['directorName'] = person.name || '';
    personVars['DirectorAddress'] = person.address || person.directorAddress || '';
    personVars['directorAddress'] = person.address || person.directorAddress || '';
    personVars['DirectorEmail'] = person.email || person.directorEmail || '';
    personVars['directorEmail'] = person.email || person.directorEmail || '';

    // 인덱스 변수도 추가 (1-based)
    const idx = personIndex + 1;
    personVars[`Director${idx}Name`] = person.name || '';
    personVars[`Director${idx}Address`] = person.address || person.directorAddress || '';
    personVars[`Director${idx}Email`] = person.email || person.directorEmail || '';
  }

  return personVars;
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
    // 누락된 변수 처리: undefined 대신 빈 문자열 반환 + 로깅
    nullGetter: (part: { module?: string; value?: string }) => {
      // 루프/조건 태그가 아닌 일반 변수만 로깅
      if (!part.module) {
        console.warn(`[WARN] Missing variable: ${part.value}`);
      }
      return '';
    },
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

    const { surveyId, selectedTemplates, overrideVariables = {}, repeatForSelections = {} } = req.body as GenerateRequest;

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

    // 디버깅: survey 구조 확인
    console.log('[DEBUG] Survey keys:', Object.keys(survey));
    console.log('[DEBUG] Survey has answers:', !!survey.answers, 'count:', survey.answers?.length || 0);
    console.log('[DEBUG] Survey has founders direct:', !!survey.founders);

    // 설문 답변을 Map으로 관리 (동일 questionId는 마지막 값으로 덮어씀)
    const responsesMap = new Map<string, SurveyResponse>();

    // 1. 기존 설문 답변 추가
    const surveyAnswers: SurveyResponse[] = survey.answers || [];
    for (const answer of surveyAnswers) {
      responsesMap.set(answer.questionId, answer);
    }

    // 1b. founders/directors가 별도 필드로 있는 경우 추가
    if (survey.founders && Array.isArray(survey.founders) && survey.founders.length > 0) {
      console.log('[DEBUG] Adding founders from survey.founders:', survey.founders.length, 'items');
      responsesMap.set('founders', { questionId: 'founders', value: survey.founders });
    }
    if (survey.directors && Array.isArray(survey.directors) && survey.directors.length > 0) {
      console.log('[DEBUG] Adding directors from survey.directors:', survey.directors.length, 'items');
      responsesMap.set('directors', { questionId: 'directors', value: survey.directors });
    }

    // 2. 고객 정보 추가 (덮어씀)
    if (survey.customerInfo) {
      if (survey.customerInfo.name) {
        responsesMap.set('__customerName', { questionId: '__customerName', value: survey.customerInfo.name });
      }
      if (survey.customerInfo.email) {
        responsesMap.set('__customerEmail', { questionId: '__customerEmail', value: survey.customerInfo.email });
      }
      if (survey.customerInfo.phone) {
        responsesMap.set('__customerPhone', { questionId: '__customerPhone', value: survey.customerInfo.phone });
      }
      if (survey.customerInfo.company) {
        responsesMap.set('__customerCompany', { questionId: '__customerCompany', value: survey.customerInfo.company });
      }
    }

    // 3. 관리자가 설정한 날짜 추가 (덮어씀)
    if (survey.adminDates) {
      if (survey.adminDates.COIDate) {
        responsesMap.set('__COIDate', { questionId: '__COIDate', value: survey.adminDates.COIDate });
      }
      if (survey.adminDates.SIGNDate) {
        responsesMap.set('__SIGNDate', { questionId: '__SIGNDate', value: survey.adminDates.SIGNDate });
      }
    }

    // 4. 관리자가 설정한 값 추가 (덮어씀)
    if (survey.adminValues) {
      if (survey.adminValues.authorizedShares) {
        responsesMap.set('__authorizedShares', { questionId: '__authorizedShares', value: survey.adminValues.authorizedShares });
      }
      if (survey.adminValues.parValue) {
        responsesMap.set('__parValue', { questionId: '__parValue', value: survey.adminValues.parValue });
      }
      if (survey.adminValues.fairMarketValue) {
        responsesMap.set('__fairMarketValue', { questionId: '__fairMarketValue', value: survey.adminValues.fairMarketValue });
      }
    }

    // Map을 배열로 변환
    const responses: SurveyResponse[] = Array.from(responsesMap.values());

    // 회사명 추출 (ZIP 파일명용)
    const companyNameResponse = responses.find(r => r.questionId === 'companyName' || r.questionId === 'companyName1');
    const companyNameValue = companyNameResponse?.value;
    const companyName: string = survey.customerInfo?.company ||
                        (Array.isArray(companyNameValue) ? companyNameValue[0] : companyNameValue) ||
                        'Company';

    // 3. 각 템플릿 처리
    const documentResults: DocumentResult[] = [];
    const generatedFiles: Array<{ filename: string; buffer: Buffer }> = [];
    const templateDebugInfo: Record<string, unknown> = {};

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

        // 디버깅: 변수 매핑 로깅
        const calculatedMappings = variableMappings.filter(m => m.questionId === '__calculated__');
        console.log(`[DEBUG] Template ${templateId} - Total mappings: ${variableMappings.length}, Calculated: ${calculatedMappings.length}`);
        if (calculatedMappings.length > 0) {
          console.log('[DEBUG] Calculated mappings:', JSON.stringify(calculatedMappings, null, 2));
        }

        // 3d. 설문 답변 → 변수 변환
        console.log('[DEBUG] Responses before transform:', JSON.stringify(responses.map(r => ({
          questionId: r.questionId,
          valueType: typeof r.value,
          isArray: Array.isArray(r.value),
          value: Array.isArray(r.value) && r.value.length > 0 && typeof r.value[0] === 'object'
            ? `[${r.value.length} objects]`
            : r.value
        })), null, 2));
        let variables = transformSurveyToVariables(responses, variableMappings);

        // 디버깅: Founder 관련 변수 로깅
        const founderVars = Object.entries(variables)
          .filter(([k]) => k.toLowerCase().includes('founder') || k.toLowerCase().includes('fmv') || k.toLowerCase().includes('share'))
          .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
        console.log(`[DEBUG] Template ${templateId} (${template.displayName || template.name}) - Founder vars:`, JSON.stringify(founderVars, null, 2));

        // 디버그 정보 저장
        templateDebugInfo[templateId] = {
          templateName: template.displayName || template.name,
          mappingsCount: variableMappings.length,
          calculatedMappings: calculatedMappings.map(m => ({ name: m.variableName, formula: m.formula })),
          founderVars,
        };

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

        // 3g. repeatFor 처리 - 인원별 문서 생성
        const repeatFor = template.repeatFor as 'founders' | 'directors' | '' | undefined;
        const selectedPersonIndices = repeatForSelections[templateId];

        if (repeatFor && selectedPersonIndices && selectedPersonIndices.length > 0) {
          // 인원별 문서 생성
          const persons = getRepeatGroupData(responses, repeatFor);
          console.log(`[DEBUG] Template ${templateId} - repeatFor: ${repeatFor}, selected: ${selectedPersonIndices.join(',')}, persons: ${persons.length}`);

          for (const personIndex of selectedPersonIndices) {
            const person = persons[personIndex];
            if (!person) {
              console.warn(`[WARN] Person at index ${personIndex} not found for template ${templateId}`);
              continue;
            }

            // 개인별 변수 생성
            const personVariables = createPersonVariables(variables, person, personIndex, repeatFor);

            try {
              // docxtemplater로 문서 생성
              const generatedBuffer = generateDocument(templateBuffer, personVariables);

              // 파일명 생성 (인원 이름 포함)
              const filename = generateFilename(
                template.displayName || template.name,
                companyName,
                person.name
              );

              generatedFiles.push({ filename, buffer: generatedBuffer });

              documentResults.push({
                templateId: `${templateId}_${personIndex}`,
                templateName: `${template.displayName || template.name} - ${person.name}`,
                filename,
                status: 'success',
                missingVariables: validation.isValid ? undefined : [...validation.missingVariables, ...validation.emptyRequired],
              });
            } catch (personDocError: any) {
              console.error(`Error generating document for ${person.name}:`, personDocError);
              documentResults.push({
                templateId: `${templateId}_${personIndex}`,
                templateName: `${template.displayName || template.name} - ${person.name}`,
                filename: '',
                status: 'error',
                error: personDocError.message || 'Document generation failed',
              });
            }
          }
        } else {
          // 일반 문서 생성 (기존 로직)
          const generatedBuffer = generateDocument(templateBuffer, variables);

          // 파일명 생성 및 저장
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
        }

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

    // 9. 응답 반환 (디버그 정보 포함)
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
      // 디버그 정보 (문제 해결 후 제거 예정)
      _debug: {
        surveyKeys: Object.keys(survey),
        hasAnswers: !!survey.answers,
        answersCount: survey.answers?.length || 0,
        hasFoundersDirect: !!survey.founders,
        foundersInAnswers: survey.answers?.find((a: SurveyResponse) => a.questionId === 'founders') ? true : false,
        foundersData: survey.answers?.find((a: SurveyResponse) => a.questionId === 'founders')?.value,
        adminValues: survey.adminValues,
        responsesQuestionIds: responses.map(r => r.questionId),
        templateDebugInfo,
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
