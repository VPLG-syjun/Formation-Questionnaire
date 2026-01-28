import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, RedisClientType } from 'redis';

// Redis 클라이언트 타입
let redisClient: RedisClientType | null = null;

// Redis 연결 생성 함수
async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error('REDIS_URL 환경변수가 설정되지 않았습니다.');
  }

  redisClient = createClient({
    url: redisUrl,
  });

  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  await redisClient.connect();
  return redisClient;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const testResults: {
    connection: boolean;
    set: boolean;
    get: boolean;
    value: string | null;
    error: string | null;
    timestamp: string;
  } = {
    connection: false,
    set: false,
    get: false,
    value: null,
    error: null,
    timestamp: new Date().toISOString(),
  };

  try {
    // 1. Redis 연결 테스트
    const client = await getRedisClient();
    testResults.connection = true;
    console.log('Redis 연결 성공');

    // 2. SET 테스트 - 테스트 키에 값 저장
    const testKey = 'test:vercel:connection';
    const testValue = `테스트 값 - ${Date.now()}`;

    await client.set(testKey, testValue, {
      EX: 60, // 60초 후 만료
    });
    testResults.set = true;
    console.log('Redis SET 성공:', testKey);

    // 3. GET 테스트 - 저장한 값 읽기
    const retrievedValue = await client.get(testKey);
    testResults.get = true;
    testResults.value = retrievedValue;
    console.log('Redis GET 성공:', retrievedValue);

    // 성공 응답
    return res.status(200).json({
      success: true,
      message: 'Redis 연결 테스트 성공',
      results: testResults,
      redisInfo: {
        connected: client.isOpen,
        url: process.env.REDIS_URL?.replace(/:[^:@]+@/, ':****@'), // 비밀번호 마스킹
      },
    });
  } catch (error) {
    // 에러 응답
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 에러';
    testResults.error = errorMessage;

    console.error('Redis 테스트 실패:', errorMessage);

    return res.status(500).json({
      success: false,
      message: 'Redis 연결 테스트 실패',
      results: testResults,
      error: errorMessage,
    });
  }
}
