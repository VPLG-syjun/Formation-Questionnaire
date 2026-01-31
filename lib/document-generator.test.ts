/**
 * document-generator.ts 테스트
 * 실행: npx ts-node lib/document-generator.test.ts
 */

import {
  numberToKorean,
  numberToKoreanCurrency,
  formatNumberWithComma,
  formatDate,
  formatPhone,
  transformText,
  generateDocumentNumber,
  transformSurveyToVariables,
  validateVariables,
  SurveyResponse,
  VariableMapping,
} from './document-generator.js';

// ============================================
// 테스트 유틸리티
// ============================================

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.log(`❌ ${name}`);
    console.error(`   Error: ${error}`);
  }
}

function assertEqual(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`Expected "${expected}" but got "${actual}"`);
  }
}

// ============================================
// 숫자 → 한글 변환 테스트
// ============================================

console.log('\n📝 숫자 → 한글 변환 테스트');
console.log('─'.repeat(40));

test('numberToKorean: 0', () => {
  assertEqual(numberToKorean(0), '영');
});

test('numberToKorean: 1', () => {
  assertEqual(numberToKorean(1), '일');
});

test('numberToKorean: 10', () => {
  assertEqual(numberToKorean(10), '십');
});

test('numberToKorean: 100', () => {
  assertEqual(numberToKorean(100), '백');
});

test('numberToKorean: 1000', () => {
  assertEqual(numberToKorean(1000), '천');
});

test('numberToKorean: 10000', () => {
  assertEqual(numberToKorean(10000), '만');
});

test('numberToKorean: 10000000 (천만)', () => {
  assertEqual(numberToKorean(10000000), '천만');
});

test('numberToKorean: 100000000 (억)', () => {
  assertEqual(numberToKorean(100000000), '억');
});

test('numberToKorean: 12345', () => {
  assertEqual(numberToKorean(12345), '만이천삼백사십오');
});

test('numberToKorean: 10000000 → 천만원', () => {
  assertEqual(numberToKoreanCurrency(10000000), '천만원');
});

test('formatNumberWithComma: 10000000', () => {
  assertEqual(formatNumberWithComma(10000000), '10,000,000');
});

// ============================================
// 날짜 변환 테스트
// ============================================

console.log('\n📅 날짜 변환 테스트');
console.log('─'.repeat(40));

const testDate = new Date('2026-01-31');

test('formatDate: YYYY-MM-DD', () => {
  assertEqual(formatDate(testDate, 'YYYY-MM-DD'), '2026-01-31');
});

test('formatDate: YYYY년 MM월 DD일', () => {
  assertEqual(formatDate(testDate, 'YYYY년 MM월 DD일'), '2026년 01월 31일');
});

test('formatDate: MM/DD/YYYY', () => {
  assertEqual(formatDate(testDate, 'MM/DD/YYYY'), '01/31/2026');
});

test('formatDate: MMMM D, YYYY', () => {
  assertEqual(formatDate(testDate, 'MMMM D, YYYY'), 'January 31, 2026');
});

test('formatDate: from string', () => {
  assertEqual(formatDate('2026-01-31', 'YYYY-MM-DD'), '2026-01-31');
});

// ============================================
// 전화번호 변환 테스트
// ============================================

console.log('\n📞 전화번호 변환 테스트');
console.log('─'.repeat(40));

test('formatPhone: 01012345678 (dashed)', () => {
  assertEqual(formatPhone('01012345678', 'dashed'), '010-1234-5678');
});

test('formatPhone: 0212345678 (dashed)', () => {
  assertEqual(formatPhone('0212345678', 'dashed'), '02-1234-5678');
});

test('formatPhone: 01012345678 (dotted)', () => {
  assertEqual(formatPhone('01012345678', 'dotted'), '010.1234.5678');
});

test('formatPhone: 01012345678 (none)', () => {
  assertEqual(formatPhone('01012345678', 'none'), '01012345678');
});

// ============================================
// 텍스트 변환 테스트
// ============================================

console.log('\n📝 텍스트 변환 테스트');
console.log('─'.repeat(40));

test('transformText: uppercase', () => {
  assertEqual(transformText('hello world', 'uppercase'), 'HELLO WORLD');
});

test('transformText: lowercase', () => {
  assertEqual(transformText('HELLO WORLD', 'lowercase'), 'hello world');
});

test('transformText: capitalize', () => {
  assertEqual(transformText('hello world', 'capitalize'), 'Hello world');
});

test('transformText: title', () => {
  assertEqual(transformText('hello world', 'title'), 'Hello World');
});

// ============================================
// 문서번호 생성 테스트
// ============================================

console.log('\n🔢 문서번호 생성 테스트');
console.log('─'.repeat(40));

test('generateDocumentNumber: 형식 확인', () => {
  const docNum = generateDocumentNumber('DOC');
  const pattern = /^DOC-\d{8}-[A-Z0-9]{6}$/;
  if (!pattern.test(docNum)) {
    throw new Error(`Invalid format: ${docNum}`);
  }
});

test('generateDocumentNumber: 날짜 없이', () => {
  const docNum = generateDocumentNumber('INV', false);
  const pattern = /^INV-[A-Z0-9]{6}$/;
  if (!pattern.test(docNum)) {
    throw new Error(`Invalid format: ${docNum}`);
  }
});

// ============================================
// 메인 변환 함수 테스트
// ============================================

console.log('\n🔄 메인 변환 함수 테스트');
console.log('─'.repeat(40));

test('transformSurveyToVariables: 기본 동작', () => {
  const responses: SurveyResponse[] = [
    { questionId: 'companyName1', value: 'Test Corp' },
    { questionId: 'email', value: 'TEST@EXAMPLE.COM' },
    { questionId: 'founder1Cash', value: '10000000' },
    { questionId: 'state', value: 'delaware' },
  ];

  const mappings: VariableMapping[] = [
    { variableName: 'companyName', questionId: 'companyName1', dataType: 'text', transformRule: 'none', required: true },
    { variableName: 'email', questionId: 'email', dataType: 'email', transformRule: 'none', required: true },
    { variableName: 'capital', questionId: 'founder1Cash', dataType: 'currency', transformRule: 'number_korean', required: true },
    { variableName: 'state', questionId: 'state', dataType: 'text', transformRule: 'uppercase', required: true },
  ];

  const result = transformSurveyToVariables(responses, mappings);

  assertEqual(result['companyName'], 'Test Corp');
  assertEqual(result['email'], 'test@example.com');
  assertEqual(result['capital'], '천만원');
  assertEqual(result['state'], 'DELAWARE');

  // 자동 생성 변수 확인
  if (!result['생성일']) throw new Error('생성일 missing');
  if (!result['문서번호']) throw new Error('문서번호 missing');
});

test('transformSurveyToVariables: 날짜 변환', () => {
  const responses: SurveyResponse[] = [
    { questionId: 'foundingDate', value: '2026-03-15' },
  ];

  const mappings: VariableMapping[] = [
    { variableName: 'foundingDate', questionId: 'foundingDate', dataType: 'date', transformRule: 'YYYY년 MM월 DD일', required: true },
  ];

  const result = transformSurveyToVariables(responses, mappings);
  assertEqual(result['foundingDate'], '2026년 03월 15일');
});

test('transformSurveyToVariables: 기본값 처리', () => {
  const responses: SurveyResponse[] = [];

  const mappings: VariableMapping[] = [
    { variableName: 'country', questionId: 'countryQ', dataType: 'text', transformRule: 'none', required: false, defaultValue: 'United States' },
  ];

  const result = transformSurveyToVariables(responses, mappings);
  assertEqual(result['country'], 'United States');
});

// ============================================
// 유효성 검사 테스트
// ============================================

console.log('\n✅ 유효성 검사 테스트');
console.log('─'.repeat(40));

test('validateVariables: 유효한 경우', () => {
  const variables = { companyName: 'Test Corp', email: 'test@test.com' };
  const mappings: VariableMapping[] = [
    { variableName: 'companyName', questionId: 'q1', dataType: 'text', transformRule: 'none', required: true },
    { variableName: 'email', questionId: 'q2', dataType: 'email', transformRule: 'none', required: true },
  ];

  const result = validateVariables(variables, mappings);
  assertEqual(result.isValid, true);
  assertEqual(result.missingVariables.length, 0);
  assertEqual(result.emptyRequired.length, 0);
});

test('validateVariables: 필수값 누락', () => {
  const variables = { companyName: '', email: 'test@test.com' };
  const mappings: VariableMapping[] = [
    { variableName: 'companyName', questionId: 'q1', dataType: 'text', transformRule: 'none', required: true },
    { variableName: 'email', questionId: 'q2', dataType: 'email', transformRule: 'none', required: true },
  ];

  const result = validateVariables(variables, mappings);
  assertEqual(result.isValid, false);
  assertEqual(result.emptyRequired.length, 1);
});

// ============================================
// 결과 요약
// ============================================

console.log('\n' + '═'.repeat(40));
console.log('테스트 완료!');
console.log('═'.repeat(40) + '\n');
