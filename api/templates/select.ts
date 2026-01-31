import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from 'redis';

const TEMPLATES_KEY = 'templates';
const TEMPLATE_RULES_KEY = 'template_rules';

async function getRedisClient() {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  return client;
}

// 조건 평가 함수
function evaluateCondition(
  answerValue: string | string[] | undefined,
  operator: string,
  conditionValue: string
): boolean {
  if (answerValue === undefined || answerValue === null) {
    return false;
  }

  const answer = Array.isArray(answerValue) ? answerValue : [answerValue];
  let conditionValues: string[];

  try {
    conditionValues = JSON.parse(conditionValue);
    if (!Array.isArray(conditionValues)) {
      conditionValues = [conditionValue];
    }
  } catch {
    conditionValues = [conditionValue];
  }

  switch (operator) {
    case '==':
      return answer.some((a) => conditionValues.includes(a));

    case '!=':
      return !answer.some((a) => conditionValues.includes(a));

    case 'contains':
      return answer.some((a) =>
        conditionValues.some((cv) => a.toLowerCase().includes(cv.toLowerCase()))
      );

    case 'not_contains':
      return !answer.some((a) =>
        conditionValues.some((cv) => a.toLowerCase().includes(cv.toLowerCase()))
      );

    case 'in':
      return answer.every((a) => conditionValues.includes(a));

    case 'not_in':
      return !answer.some((a) => conditionValues.includes(a));

    case '>=':
      return answer.some((a) => parseFloat(a) >= parseFloat(conditionValues[0]));

    case '<=':
      return answer.some((a) => parseFloat(a) <= parseFloat(conditionValues[0]));

    case '>':
      return answer.some((a) => parseFloat(a) > parseFloat(conditionValues[0]));

    case '<':
      return answer.some((a) => parseFloat(a) < parseFloat(conditionValues[0]));

    default:
      return false;
  }
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

    const { answers } = req.body;

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: '설문 답변이 필요합니다.' });
    }

    // 모든 활성화된 템플릿 조회
    const allTemplates = await client.hGetAll(TEMPLATES_KEY);
    const templates = Object.values(allTemplates)
      .map((t) => JSON.parse(t))
      .filter((t) => t.isActive);

    // 모든 규칙 조회
    const allRules = await client.hGetAll(TEMPLATE_RULES_KEY);
    const rules = Object.values(allRules)
      .map((r) => JSON.parse(r))
      .sort((a, b) => a.priority - b.priority);

    // 각 템플릿에 대해 규칙 평가
    const matchedTemplates: Array<{
      template: any;
      rule: any;
      matchScore: number;
    }> = [];

    for (const template of templates) {
      const templateRules = rules.filter((r) => r.templateId === template.id);

      // 규칙이 없으면 건너뜀
      if (templateRules.length === 0) {
        continue;
      }

      for (const rule of templateRules) {
        let matched = false;
        let matchScore = 100 - rule.priority; // 우선순위가 낮을수록 점수 높음

        if (rule.ruleType === 'always') {
          // 항상 선택
          matched = true;
        } else if (rule.ruleType === 'question_answer') {
          // 질문 답변 기반 선택
          if (rule.questionId && rule.conditionOperator && rule.conditionValue !== null) {
            const answerValue = answers[rule.questionId];
            matched = evaluateCondition(answerValue, rule.conditionOperator, rule.conditionValue);
          }
        } else if (rule.ruleType === 'calculated') {
          // 계산 기반 선택 (추후 구현)
          // 예: 총 금액이 특정 값 이상일 때 등
          matched = false;
        }

        if (matched) {
          matchedTemplates.push({
            template,
            rule,
            matchScore,
          });
          break; // 하나의 규칙만 매칭되면 다음 템플릿으로
        }
      }
    }

    // 점수순 정렬 (높은 점수 = 높은 우선순위)
    matchedTemplates.sort((a, b) => b.matchScore - a.matchScore);

    return res.status(200).json({
      selectedTemplates: matchedTemplates.map((m) => m.template),
      matchedRules: matchedTemplates,
      totalMatched: matchedTemplates.length,
    });
  } catch (error) {
    console.error('Template Selection API Error:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  } finally {
    if (client) await client.disconnect();
  }
}
