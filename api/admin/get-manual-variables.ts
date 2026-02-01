import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from 'redis';

const TEMPLATES_KEY = 'templates';
const TEMPLATE_VARIABLES_KEY = 'template_variables';

async function getRedisClient() {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  return client;
}

export interface ManualVariable {
  id: string;
  templateId: string;
  templateName: string;
  variableName: string;
  dataType: string;
  transformRule: string;
  required: boolean;
  defaultValue?: string;
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

    const { templateIds } = req.body;

    if (!templateIds || !Array.isArray(templateIds) || templateIds.length === 0) {
      return res.status(400).json({ error: 'templateIds array is required' });
    }

    // 템플릿 정보 조회
    const templatesMap: Record<string, string> = {};
    for (const templateId of templateIds) {
      const templateData = await client.hGet(TEMPLATES_KEY, templateId);
      if (templateData) {
        const template = JSON.parse(templateData);
        templatesMap[templateId] = template.displayName || template.name;
      }
    }

    // 모든 변수 조회
    const allVariables = await client.hGetAll(TEMPLATE_VARIABLES_KEY);
    const variables = Object.values(allVariables).map(v => JSON.parse(v as string));

    // 선택된 템플릿의 직접 입력 변수만 필터링
    const manualVariables: ManualVariable[] = variables
      .filter(v =>
        templateIds.includes(v.templateId) &&
        (v.questionId === '__manual__' || v.questionId === '__calculated__')
      )
      .map(v => ({
        id: v.id,
        templateId: v.templateId,
        templateName: templatesMap[v.templateId] || v.templateId,
        variableName: v.variableName,
        dataType: v.dataType || 'text',
        transformRule: v.transformRule || 'none',
        required: v.required || false,
        defaultValue: v.defaultValue || '',
      }));

    // 변수명으로 그룹화 (여러 템플릿에서 같은 변수를 사용할 수 있음)
    const groupedVariables: Record<string, ManualVariable[]> = {};
    manualVariables.forEach(v => {
      if (!groupedVariables[v.variableName]) {
        groupedVariables[v.variableName] = [];
      }
      groupedVariables[v.variableName].push(v);
    });

    // 중복 제거된 고유 변수 목록
    const uniqueVariables = Object.entries(groupedVariables).map(([variableName, vars]) => {
      // 같은 변수명 중 required가 하나라도 있으면 required로 표시
      const isRequired = vars.some(v => v.required);
      const firstVar = vars[0];
      return {
        variableName,
        dataType: firstVar.dataType,
        transformRule: firstVar.transformRule,
        required: isRequired,
        defaultValue: firstVar.defaultValue,
        usedInTemplates: vars.map(v => v.templateName),
      };
    });

    return res.status(200).json({
      variables: uniqueVariables,
      totalCount: uniqueVariables.length,
      requiredCount: uniqueVariables.filter(v => v.required).length,
    });

  } catch (error: any) {
    console.error('Get Manual Variables API Error:', error);
    return res.status(500).json({
      error: 'Server error occurred',
      details: error.message,
    });
  } finally {
    if (client) await client.disconnect();
  }
}
