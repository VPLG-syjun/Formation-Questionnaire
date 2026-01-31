import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from 'redis';
import { v4 as uuidv4 } from 'uuid';

const TEMPLATES_KEY = 'templates';
const TEMPLATE_VARIABLES_KEY = 'template_variables';

async function getRedisClient() {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  return client;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let client;
  try {
    client = await getRedisClient();

    if (req.method === 'POST') {
      const { templateId, variables } = req.body;

      // 일괄 저장 모드 (variables 배열이 있는 경우)
      if (templateId && Array.isArray(variables)) {
        // 템플릿 존재 확인
        const templateExists = await client.hExists(TEMPLATES_KEY, templateId);
        if (!templateExists) {
          return res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
        }

        // 기존 변수 삭제
        const allVariables = await client.hGetAll(TEMPLATE_VARIABLES_KEY);
        for (const [varId, varData] of Object.entries(allVariables)) {
          const variable = JSON.parse(varData);
          if (variable.templateId === templateId) {
            await client.hDel(TEMPLATE_VARIABLES_KEY, varId);
          }
        }

        // 새 변수 저장
        const savedVariables = [];
        for (const v of variables) {
          const id = v.id || uuidv4();
          const variable = {
            id,
            templateId,
            variableName: v.variableName,
            questionId: v.questionId || '__manual__',
            dataType: v.dataType || 'text',
            transformRule: v.transformRule || 'none',
            required: v.required !== undefined ? v.required : true,
          };

          await client.hSet(TEMPLATE_VARIABLES_KEY, id, JSON.stringify(variable));
          savedVariables.push(variable);
        }

        return res.status(200).json({
          message: `${savedVariables.length}개의 변수가 저장되었습니다.`,
          variables: savedVariables,
        });
      }

      // 단일 변수 생성 모드 (기존 방식)
      const {
        variableName,
        variableKey,
        questionIds,
        dataType,
        isRequired,
        defaultValue,
        transformationRule,
      } = req.body;

      if (!templateId || !variableName || !variableKey) {
        return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
      }

      // 템플릿 존재 확인
      const templateExists = await client.hExists(TEMPLATES_KEY, templateId);
      if (!templateExists) {
        return res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
      }

      const id = uuidv4();
      const variable = {
        id,
        templateId,
        variableName,
        variableKey,
        questionIds: questionIds || [],
        dataType: dataType || 'text',
        isRequired: isRequired || false,
        defaultValue: defaultValue || null,
        transformationRule: transformationRule || null,
      };

      await client.hSet(TEMPLATE_VARIABLES_KEY, id, JSON.stringify(variable));

      return res.status(201).json({ id, message: '변수가 생성되었습니다.', variable });
    }

    if (req.method === 'GET') {
      // 템플릿 변수 목록 조회
      const { templateId } = req.query;
      const allVariables = await client.hGetAll(TEMPLATE_VARIABLES_KEY);

      let variables = Object.values(allVariables).map((v) => JSON.parse(v));

      if (templateId) {
        variables = variables.filter((v) => v.templateId === templateId);
      }

      return res.status(200).json(variables);
    }

    if (req.method === 'PATCH') {
      // 변수 수정
      const { id } = req.query;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'ID가 필요합니다.' });
      }

      const varData = await client.hGet(TEMPLATE_VARIABLES_KEY, id);
      if (!varData) {
        return res.status(404).json({ error: '변수를 찾을 수 없습니다.' });
      }

      const variable = JSON.parse(varData);
      const updates = req.body;

      Object.keys(updates).forEach((key) => {
        if (key !== 'id' && key !== 'templateId') {
          variable[key] = updates[key];
        }
      });

      await client.hSet(TEMPLATE_VARIABLES_KEY, id, JSON.stringify(variable));

      return res.status(200).json({ message: '변수가 수정되었습니다.', variable });
    }

    if (req.method === 'DELETE') {
      // 변수 삭제
      const { id } = req.query;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'ID가 필요합니다.' });
      }

      const deleted = await client.hDel(TEMPLATE_VARIABLES_KEY, id);
      if (!deleted) {
        return res.status(404).json({ error: '변수를 찾을 수 없습니다.' });
      }

      return res.status(200).json({ message: '변수가 삭제되었습니다.' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Template Variables API Error:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  } finally {
    if (client) await client.disconnect();
  }
}
