import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from 'redis';
import { v4 as uuidv4 } from 'uuid';

const TEMPLATES_KEY = 'templates';
const TEMPLATE_RULES_KEY = 'template_rules';

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
      // 템플릿 규칙 생성
      const {
        templateId,
        ruleType,
        questionId,
        conditionOperator,
        conditionValue,
        priority,
      } = req.body;

      if (!templateId || !ruleType) {
        return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
      }

      // 템플릿 존재 확인
      const templateExists = await client.hExists(TEMPLATES_KEY, templateId);
      if (!templateExists) {
        return res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
      }

      // ruleType 검증
      if (!['question_answer', 'calculated', 'always'].includes(ruleType)) {
        return res.status(400).json({ error: '유효하지 않은 규칙 타입입니다.' });
      }

      const id = uuidv4();
      const rule = {
        id,
        templateId,
        ruleType,
        questionId: questionId || null,
        conditionOperator: conditionOperator || null,
        conditionValue: conditionValue || null,
        priority: priority ?? 100,
      };

      await client.hSet(TEMPLATE_RULES_KEY, id, JSON.stringify(rule));

      return res.status(201).json({ id, message: '규칙이 생성되었습니다.', rule });
    }

    if (req.method === 'GET') {
      // 템플릿 규칙 목록 조회
      const { templateId } = req.query;
      const allRules = await client.hGetAll(TEMPLATE_RULES_KEY);

      let rules = Object.values(allRules).map((r) => JSON.parse(r));

      if (templateId) {
        rules = rules.filter((r) => r.templateId === templateId);
      }

      // 우선순위 정렬
      rules.sort((a, b) => a.priority - b.priority);

      return res.status(200).json(rules);
    }

    if (req.method === 'PATCH') {
      // 규칙 수정
      const { id } = req.query;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'ID가 필요합니다.' });
      }

      const ruleData = await client.hGet(TEMPLATE_RULES_KEY, id);
      if (!ruleData) {
        return res.status(404).json({ error: '규칙을 찾을 수 없습니다.' });
      }

      const rule = JSON.parse(ruleData);
      const updates = req.body;

      Object.keys(updates).forEach((key) => {
        if (key !== 'id' && key !== 'templateId') {
          rule[key] = updates[key];
        }
      });

      await client.hSet(TEMPLATE_RULES_KEY, id, JSON.stringify(rule));

      return res.status(200).json({ message: '규칙이 수정되었습니다.', rule });
    }

    if (req.method === 'DELETE') {
      // 규칙 삭제
      const { id } = req.query;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'ID가 필요합니다.' });
      }

      const deleted = await client.hDel(TEMPLATE_RULES_KEY, id);
      if (!deleted) {
        return res.status(404).json({ error: '규칙을 찾을 수 없습니다.' });
      }

      return res.status(200).json({ message: '규칙이 삭제되었습니다.' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Template Rules API Error:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  } finally {
    if (client) await client.disconnect();
  }
}
