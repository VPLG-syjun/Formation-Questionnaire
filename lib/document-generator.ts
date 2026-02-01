/**
 * 설문 답변을 템플릿 변수로 변환하는 핵심 로직
 * lib/document-generator.ts
 */

// ============================================
// 타입 정의
// ============================================

export interface SurveyResponse {
  questionId: string;
  value: string | string[];
  price?: number;
}

export interface VariableMapping {
  id?: string;
  variableName: string;
  questionId: string;      // '__manual__' | '__calculated__' | 실제 질문 ID
  dataType: 'text' | 'date' | 'number' | 'currency' | 'email' | 'phone';
  transformRule: string;
  required: boolean;
  defaultValue?: string;
}

export interface TransformOptions {
  documentNumber?: string;
  locale?: string;
  timezone?: string;
}

// 템플릿 선택 관련 타입
export interface RuleCondition {
  questionId: string;
  operator: '==' | '!=' | 'contains' | 'not_contains' | 'in' | '>' | '>=' | '<' | '<=';
  value: string;
}

export interface SelectionRule {
  id?: string;
  conditions: RuleCondition[];
  priority: number;
  isAlwaysInclude: boolean;
  isManualOnly: boolean;
}

export interface Template {
  id: string;
  name: string;
  displayName: string;
  category: string;
  rules?: SelectionRule[];
  variables?: VariableMapping[];
  isActive: boolean;
}

export interface TemplateSelection {
  required: Template[];   // 필수 템플릿 (규칙 100% 충족 또는 "항상 사용")
  suggested: Template[];  // 추천 템플릿 (규칙 부분 충족)
  optional: Template[];   // 선택적 템플릿 (매뉴얼 선택용)
}

export interface RuleEvaluationResult {
  templateId: string;
  score: number;           // 0.0 ~ 1.0
  matchedRules: number;
  totalRules: number;
  isAlwaysInclude: boolean;
  isManualOnly: boolean;
}

// ============================================
// 숫자 → 한글 변환 유틸리티
// ============================================

const KOREAN_NUMBERS = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const KOREAN_UNITS = ['', '십', '백', '천'];
const KOREAN_BIG_UNITS = ['', '만', '억', '조', '경'];

/**
 * 숫자를 한글로 변환
 * @example numberToKorean(10000000) → "일천만"
 * @example numberToKorean(12345678) → "일천이백삼십사만오천육백칠십팔"
 */
export function numberToKorean(num: number | string): string {
  const n = typeof num === 'string' ? parseInt(num.replace(/[^0-9]/g, ''), 10) : num;

  if (isNaN(n) || n === 0) return '영';
  if (n < 0) return '마이너스 ' + numberToKorean(-n);

  let result = '';
  let numStr = n.toString();

  // 4자리씩 끊어서 처리 (만, 억, 조, 경 단위)
  const chunks: number[] = [];
  while (numStr.length > 0) {
    chunks.unshift(parseInt(numStr.slice(-4), 10) || 0);
    numStr = numStr.slice(0, -4);
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (chunk === 0) continue;

    const bigUnitIndex = chunks.length - 1 - i;
    const bigUnit = KOREAN_BIG_UNITS[bigUnitIndex];

    // 정확히 1이고 만/억/조/경 단위가 있는 경우: "일만" → "만"
    if (chunk === 1 && bigUnitIndex > 0) {
      result += bigUnit;
    } else {
      const chunkStr = convertChunk(chunk);
      result += chunkStr + bigUnit;
    }
  }

  return result || '영';
}

function convertChunk(num: number): string {
  if (num === 0) return '';

  let result = '';
  const numStr = num.toString().padStart(4, '0');

  for (let i = 0; i < 4; i++) {
    const digit = parseInt(numStr[i], 10);
    if (digit === 0) continue;

    const unitIndex = 3 - i;

    // 1의 경우 특수 처리 (일십 → 십, 일백 → 백, 일천 → 천)
    if (digit === 1 && unitIndex > 0) {
      result += KOREAN_UNITS[unitIndex];
    } else {
      result += KOREAN_NUMBERS[digit] + KOREAN_UNITS[unitIndex];
    }
  }

  return result;
}

/**
 * 숫자를 한글 금액으로 변환 (원 단위 포함)
 * @example numberToKoreanCurrency(10000000) → "일천만원"
 */
export function numberToKoreanCurrency(num: number | string): string {
  return numberToKorean(num) + '원';
}

/**
 * 숫자를 콤마 형식으로 변환
 * @example formatNumberWithComma(10000000) → "10,000,000"
 */
export function formatNumberWithComma(num: number | string): string {
  const n = typeof num === 'string' ? parseFloat(num.replace(/[^0-9.-]/g, '')) : num;
  if (isNaN(n)) return '0';
  return n.toLocaleString('en-US');
}

// ============================================
// 숫자 → 영어 변환 유틸리티
// ============================================

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

/**
 * 숫자를 영어로 변환
 * @example numberToEnglish(1000000) → "One Million"
 * @example numberToEnglish(12345) → "Twelve Thousand Three Hundred Forty Five"
 */
export function numberToEnglish(num: number | string): string {
  const n = typeof num === 'string' ? parseInt(num.replace(/[^0-9]/g, ''), 10) : num;

  if (isNaN(n)) return '';
  if (n === 0) return 'Zero';
  if (n < 0) return 'Negative ' + numberToEnglish(-n);

  const words: string[] = [];
  let numStr = n.toString();

  // 3자리씩 끊어서 처리
  const chunks: number[] = [];
  while (numStr.length > 0) {
    chunks.unshift(parseInt(numStr.slice(-3), 10) || 0);
    numStr = numStr.slice(0, -3);
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (chunk === 0) continue;

    const scaleIndex = chunks.length - 1 - i;
    const chunkWords = convertEnglishChunk(chunk);

    if (chunkWords) {
      words.push(chunkWords);
      if (SCALES[scaleIndex]) {
        words.push(SCALES[scaleIndex]);
      }
    }
  }

  return words.join(' ') || 'Zero';
}

function convertEnglishChunk(num: number): string {
  if (num === 0) return '';

  const words: string[] = [];

  // 백의 자리
  const hundreds = Math.floor(num / 100);
  if (hundreds > 0) {
    words.push(ONES[hundreds] + ' Hundred');
  }

  // 십의 자리와 일의 자리
  const remainder = num % 100;
  if (remainder > 0) {
    if (remainder < 20) {
      words.push(ONES[remainder]);
    } else {
      const tens = Math.floor(remainder / 10);
      const ones = remainder % 10;
      words.push(TENS[tens] + (ones > 0 ? ' ' + ONES[ones] : ''));
    }
  }

  return words.join(' ');
}

/**
 * 숫자를 영어 달러 금액으로 변환
 * @example numberToEnglishCurrency(1000000) → "One Million Dollars"
 */
export function numberToEnglishCurrency(num: number | string): string {
  const n = typeof num === 'string' ? parseInt(num.replace(/[^0-9]/g, ''), 10) : num;
  if (n === 1) return 'One Dollar';
  return numberToEnglish(n) + ' Dollars';
}

/**
 * 숫자를 영어 서수로 변환
 * @example numberToOrdinal(1) → "First"
 * @example numberToOrdinal(2) → "Second"
 * @example numberToOrdinal(21) → "Twenty First"
 */
export function numberToOrdinal(num: number | string): string {
  const n = typeof num === 'string' ? parseInt(num.replace(/[^0-9]/g, ''), 10) : num;

  if (isNaN(n) || n < 1) return '';

  // 1-19의 서수
  const ORDINALS_ONES = [
    '', 'First', 'Second', 'Third', 'Fourth', 'Fifth',
    'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth',
    'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth',
    'Sixteenth', 'Seventeenth', 'Eighteenth', 'Nineteenth'
  ];

  // 10단위 서수
  const ORDINALS_TENS = [
    '', '', 'Twentieth', 'Thirtieth', 'Fortieth', 'Fiftieth',
    'Sixtieth', 'Seventieth', 'Eightieth', 'Ninetieth'
  ];

  // 10단위 기본형 (합성용)
  const TENS_BASE = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
    'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  if (n < 20) {
    return ORDINALS_ONES[n];
  }

  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    if (ones === 0) {
      return ORDINALS_TENS[tens];
    }
    return TENS_BASE[tens] + ' ' + ORDINALS_ONES[ones];
  }

  // 100 이상은 기본 숫자 + "th" (간단한 처리)
  // 예: 100 → "One Hundredth", 101 → "One Hundred First"
  if (n % 100 === 0) {
    return numberToEnglish(n / 100) + ' Hundredth';
  }

  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;
  return numberToEnglish(hundreds) + ' Hundred ' + numberToOrdinal(remainder);
}

// ============================================
// 날짜 변환 유틸리티
// ============================================

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * 날짜를 지정된 형식으로 변환
 * @param value - 날짜 문자열 또는 Date 객체
 * @param format - 출력 형식
 *
 * 지원 형식:
 * - 'YYYY-MM-DD' → 2026-01-31
 * - 'YYYY년 MM월 DD일' → 2026년 01월 31일
 * - 'MM/DD/YYYY' → 01/31/2026
 * - 'MMMM D, YYYY' → January 31, 2026
 * - 'YYYY.MM.DD' → 2026.01.31
 */
export function formatDate(value: string | Date | undefined, format: string = 'YYYY-MM-DD'): string {
  if (!value) return '';

  const date = typeof value === 'string' ? new Date(value) : value;

  if (isNaN(date.getTime())) return value?.toString() || '';

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const pad = (n: number) => n.toString().padStart(2, '0');

  switch (format) {
    case 'YYYY-MM-DD':
      return `${year}-${pad(month)}-${pad(day)}`;

    case 'YYYY년 MM월 DD일':
      return `${year}년 ${pad(month)}월 ${pad(day)}일`;

    case 'MM/DD/YYYY':
      return `${pad(month)}/${pad(day)}/${year}`;

    case 'MMMM D, YYYY':
      return `${MONTH_NAMES_EN[month - 1]} ${day}, ${year}`;

    case 'MMM D, YYYY':
      return `${MONTH_NAMES_SHORT[month - 1]} ${day}, ${year}`;

    case 'YYYY.MM.DD':
      return `${year}.${pad(month)}.${pad(day)}`;

    case 'DD/MM/YYYY':
      return `${pad(day)}/${pad(month)}/${year}`;

    default:
      // 커스텀 형식 지원
      return format
        .replace('YYYY', year.toString())
        .replace('MM', pad(month))
        .replace('DD', pad(day))
        .replace('MMMM', MONTH_NAMES_EN[month - 1])
        .replace('MMM', MONTH_NAMES_SHORT[month - 1])
        .replace('M', month.toString())
        .replace('D', day.toString());
  }
}

/**
 * 현재 날짜를 지정된 형식으로 반환
 */
export function getCurrentDate(format: string = 'YYYY-MM-DD'): string {
  return formatDate(new Date(), format);
}

/**
 * 현재 시간을 반환
 * @param format - 'HH:mm' | 'HH:mm:ss' | 'h:mm A'
 */
export function getCurrentTime(format: string = 'HH:mm'): string {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  const pad = (n: number) => n.toString().padStart(2, '0');

  switch (format) {
    case 'HH:mm':
      return `${pad(hours)}:${pad(minutes)}`;

    case 'HH:mm:ss':
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

    case 'h:mm A':
      const h = hours % 12 || 12;
      const ampm = hours < 12 ? 'AM' : 'PM';
      return `${h}:${pad(minutes)} ${ampm}`;

    default:
      return `${pad(hours)}:${pad(minutes)}`;
  }
}

// ============================================
// 전화번호 변환 유틸리티
// ============================================

/**
 * 전화번호 형식 정리
 * @param phone - 전화번호 문자열
 * @param format - 'dashed' | 'dotted' | 'none'
 *
 * @example formatPhone('01012345678', 'dashed') → '010-1234-5678'
 * @example formatPhone('021234567', 'dashed') → '02-123-4567'
 */
export function formatPhone(phone: string | undefined, format: string = 'dashed'): string {
  if (!phone) return '';

  // 숫자만 추출
  const digits = phone.replace(/[^0-9]/g, '');

  if (digits.length < 9) return phone;

  let formatted: string;

  // 서울 지역번호 (02)
  if (digits.startsWith('02')) {
    if (digits.length === 9) {
      formatted = `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    } else {
      formatted = `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
  }
  // 휴대폰 또는 기타 지역번호
  else if (digits.length === 10) {
    formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11) {
    formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  } else {
    formatted = phone;
  }

  // 형식에 따라 구분자 변경
  switch (format) {
    case 'dashed':
      return formatted;
    case 'dotted':
      return formatted.replace(/-/g, '.');
    case 'none':
      return digits;
    default:
      return formatted;
  }
}

// ============================================
// 텍스트 변환 유틸리티
// ============================================

/**
 * 텍스트 변환 규칙 적용
 */
export function transformText(text: string | undefined, rule: string): string {
  if (!text) return '';

  switch (rule) {
    case 'uppercase':
      return text.toUpperCase();

    case 'lowercase':
      return text.toLowerCase();

    case 'capitalize':
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

    case 'title':
      return text.replace(/\b\w/g, c => c.toUpperCase());

    case 'trim':
      return text.trim();

    default:
      return text;
  }
}

// ============================================
// 문서번호 생성 유틸리티
// ============================================

/**
 * 문서번호 생성
 * @param prefix - 접두사 (예: 'DOC', 'INV')
 * @param includeDate - 날짜 포함 여부
 *
 * @example generateDocumentNumber('DOC') → 'DOC-20260131-A1B2C3'
 */
export function generateDocumentNumber(prefix: string = 'DOC', includeDate: boolean = true): string {
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();

  if (includeDate) {
    const date = new Date();
    const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
    return `${prefix}-${dateStr}-${randomPart}`;
  }

  return `${prefix}-${randomPart}`;
}

// ============================================
// 메인 변환 함수
// ============================================

/**
 * 설문 답변을 템플릿 변수로 변환
 *
 * @param responses - 설문 답변 배열
 * @param variableMappings - 템플릿 변수 매핑 정의
 * @param options - 추가 옵션
 *
 * @returns 변수명: 값 형태의 객체
 */
export function transformSurveyToVariables(
  responses: SurveyResponse[],
  variableMappings: VariableMapping[],
  options: TransformOptions = {}
): Record<string, string> {
  const result: Record<string, string> = {};

  // 1. 특수 변수 자동 생성 (영문 템플릿용)
  result['currentDate'] = getCurrentDate('MMMM D, YYYY');
  result['currentDateShort'] = getCurrentDate('MM/DD/YYYY');
  result['currentDateISO'] = getCurrentDate('YYYY-MM-DD');
  result['currentTime'] = getCurrentTime('h:mm A');
  result['documentNumber'] = options.documentNumber || generateDocumentNumber('FR');
  result['currentYear'] = new Date().getFullYear().toString();

  // 한글 날짜 (필요한 경우)
  result['currentDateKR'] = getCurrentDate('YYYY년 MM월 DD일');

  // 3. 관리자 설정 날짜 (COIDate, SIGNDate) 처리
  const coiDateResponse = responses.find(r => r.questionId === '__COIDate');
  if (coiDateResponse?.value) {
    const coiDateValue = Array.isArray(coiDateResponse.value) ? coiDateResponse.value[0] : coiDateResponse.value;
    result['COIDate'] = formatDate(coiDateValue, 'MMMM D, YYYY');
    result['COIDateShort'] = formatDate(coiDateValue, 'MM/DD/YYYY');
    result['COIDateISO'] = formatDate(coiDateValue, 'YYYY-MM-DD');
    result['COIDateKR'] = formatDate(coiDateValue, 'YYYY년 MM월 DD일');
  } else {
    // 기본값: 현재 날짜
    result['COIDate'] = getCurrentDate('MMMM D, YYYY');
    result['COIDateShort'] = getCurrentDate('MM/DD/YYYY');
    result['COIDateISO'] = getCurrentDate('YYYY-MM-DD');
    result['COIDateKR'] = getCurrentDate('YYYY년 MM월 DD일');
  }

  const signDateResponse = responses.find(r => r.questionId === '__SIGNDate');
  if (signDateResponse?.value) {
    const signDateValue = Array.isArray(signDateResponse.value) ? signDateResponse.value[0] : signDateResponse.value;
    result['SIGNDate'] = formatDate(signDateValue, 'MMMM D, YYYY');
    result['SIGNDateShort'] = formatDate(signDateValue, 'MM/DD/YYYY');
    result['SIGNDateISO'] = formatDate(signDateValue, 'YYYY-MM-DD');
    result['SIGNDateKR'] = formatDate(signDateValue, 'YYYY년 MM월 DD일');
  } else {
    // 기본값: 현재 날짜
    result['SIGNDate'] = getCurrentDate('MMMM D, YYYY');
    result['SIGNDateShort'] = getCurrentDate('MM/DD/YYYY');
    result['SIGNDateISO'] = getCurrentDate('YYYY-MM-DD');
    result['SIGNDateKR'] = getCurrentDate('YYYY년 MM월 DD일');
  }

  // 4. 매핑된 변수 처리
  for (const mapping of variableMappings) {
    const variableKey = mapping.variableName;

    // 직접 입력 또는 계산된 값인 경우 건너뛰기 (나중에 수동 입력)
    if (mapping.questionId === '__manual__' || mapping.questionId === '__calculated__') {
      if (mapping.defaultValue) {
        result[variableKey] = mapping.defaultValue;
      }
      continue;
    }

    // 답변 찾기
    const response = responses.find(r => r.questionId === mapping.questionId);
    let value = response?.value;

    // 배열인 경우 콤마로 합치기
    if (Array.isArray(value)) {
      value = value.join(', ');
    }

    // 값이 없으면 기본값 사용
    if (!value && mapping.defaultValue) {
      value = mapping.defaultValue;
    }

    // 값이 없으면 빈 문자열
    if (!value) {
      result[variableKey] = '';
      continue;
    }

    // 데이터 타입에 따른 변환
    let transformedValue: string;

    switch (mapping.dataType) {
      case 'date':
        transformedValue = formatDate(value, mapping.transformRule || 'YYYY-MM-DD');
        break;

      case 'number':
        switch (mapping.transformRule) {
          case 'comma':
            transformedValue = formatNumberWithComma(value);
            break;
          case 'number_english':
            transformedValue = numberToEnglish(value);
            break;
          case 'ordinal_english':
            transformedValue = numberToOrdinal(value);
            break;
          default:
            transformedValue = value;
        }
        break;

      case 'currency':
        switch (mapping.transformRule) {
          case 'number_english':
            transformedValue = numberToEnglishCurrency(value);
            break;
          case 'number_korean':
            transformedValue = numberToKoreanCurrency(value);
            break;
          case 'comma_dollar':
            transformedValue = '$' + formatNumberWithComma(value);
            break;
          case 'comma_dollar_cents':
            const numVal = parseFloat(value.replace(/[^0-9.-]/g, ''));
            transformedValue = '$' + numVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            break;
          case 'comma_won':
            transformedValue = formatNumberWithComma(value) + '원';
            break;
          default:
            transformedValue = '$' + formatNumberWithComma(value);
        }
        break;

      case 'phone':
        transformedValue = formatPhone(value, mapping.transformRule || 'dashed');
        break;

      case 'email':
        transformedValue = value.toLowerCase().trim();
        break;

      case 'text':
      default:
        transformedValue = transformText(value, mapping.transformRule || 'none');
        break;
    }

    result[variableKey] = transformedValue;
  }

  return result;
}

// ============================================
// 변수 유효성 검사
// ============================================

export interface ValidationResult {
  isValid: boolean;
  missingVariables: string[];
  emptyRequired: string[];
}

/**
 * 필수 변수가 모두 채워졌는지 검사
 */
export function validateVariables(
  variables: Record<string, string>,
  mappings: VariableMapping[]
): ValidationResult {
  const missingVariables: string[] = [];
  const emptyRequired: string[] = [];

  for (const mapping of mappings) {
    const value = variables[mapping.variableName];

    if (value === undefined) {
      missingVariables.push(mapping.variableName);
    } else if (mapping.required && !value.trim()) {
      emptyRequired.push(mapping.variableName);
    }
  }

  return {
    isValid: missingVariables.length === 0 && emptyRequired.length === 0,
    missingVariables,
    emptyRequired,
  };
}

// ============================================
// 템플릿 선택 로직
// ============================================

/**
 * 단일 조건 평가
 * @param condition - 평가할 조건
 * @param responses - 설문 답변 배열
 * @returns 조건 충족 여부
 */
export function evaluateCondition(
  condition: RuleCondition,
  responses: SurveyResponse[]
): boolean {
  const response = responses.find(r => r.questionId === condition.questionId);
  const actualValue = response?.value;

  // 답변이 없는 경우
  if (actualValue === undefined || actualValue === null) {
    // != 연산자는 값이 없어도 true
    if (condition.operator === '!=') return true;
    return false;
  }

  // 배열 값을 문자열로 변환
  const valueStr = Array.isArray(actualValue) ? actualValue.join(',') : String(actualValue);
  const conditionValue = condition.value;

  switch (condition.operator) {
    case '==':
      // 숫자 비교 시도 (양쪽이 숫자인 경우)
      const numValue = parseFloat(valueStr);
      const numCondition = parseFloat(conditionValue);
      if (!isNaN(numValue) && !isNaN(numCondition)) {
        return numValue === numCondition;
      }
      return valueStr.toLowerCase() === conditionValue.toLowerCase();

    case '!=':
      // 숫자 비교 시도
      const numValue2 = parseFloat(valueStr);
      const numCondition2 = parseFloat(conditionValue);
      if (!isNaN(numValue2) && !isNaN(numCondition2)) {
        return numValue2 !== numCondition2;
      }
      return valueStr.toLowerCase() !== conditionValue.toLowerCase();

    case 'contains':
      return valueStr.toLowerCase().includes(conditionValue.toLowerCase());

    case 'not_contains':
      return !valueStr.toLowerCase().includes(conditionValue.toLowerCase());

    case 'in':
      // conditionValue가 콤마로 구분된 값 목록인 경우
      const allowedValues = conditionValue.split(',').map(v => v.trim().toLowerCase());
      return allowedValues.includes(valueStr.toLowerCase());

    case '>':
      const numVal1 = parseFloat(valueStr);
      const numCond1 = parseFloat(conditionValue);
      return !isNaN(numVal1) && !isNaN(numCond1) && numVal1 > numCond1;

    case '>=':
      const numVal2 = parseFloat(valueStr);
      const numCond2 = parseFloat(conditionValue);
      return !isNaN(numVal2) && !isNaN(numCond2) && numVal2 >= numCond2;

    case '<':
      const numVal3 = parseFloat(valueStr);
      const numCond3 = parseFloat(conditionValue);
      return !isNaN(numVal3) && !isNaN(numCond3) && numVal3 < numCond3;

    case '<=':
      const numVal4 = parseFloat(valueStr);
      const numCond4 = parseFloat(conditionValue);
      return !isNaN(numVal4) && !isNaN(numCond4) && numVal4 <= numCond4;

    default:
      return false;
  }
}

/**
 * 템플릿의 규칙들을 평가하고 점수 반환
 * @param template - 평가할 템플릿
 * @param responses - 설문 답변 배열
 * @returns 평가 결과 (0.0 ~ 1.0 점수 포함)
 */
export function evaluateRules(
  template: Template,
  responses: SurveyResponse[]
): RuleEvaluationResult {
  const rules = template.rules || [];

  // 규칙이 없는 경우
  if (rules.length === 0) {
    return {
      templateId: template.id,
      score: 0,
      matchedRules: 0,
      totalRules: 0,
      isAlwaysInclude: false,
      isManualOnly: false,
    };
  }

  // "항상 사용" 규칙 확인
  const alwaysIncludeRule = rules.find(r => r.isAlwaysInclude);
  if (alwaysIncludeRule) {
    return {
      templateId: template.id,
      score: 1.0,
      matchedRules: rules.length,
      totalRules: rules.length,
      isAlwaysInclude: true,
      isManualOnly: false,
    };
  }

  // "수동 선택만" 규칙 확인
  const manualOnlyRule = rules.find(r => r.isManualOnly);
  if (manualOnlyRule) {
    return {
      templateId: template.id,
      score: 0,
      matchedRules: 0,
      totalRules: rules.length,
      isAlwaysInclude: false,
      isManualOnly: true,
    };
  }

  // 일반 규칙 평가 - 각 규칙의 모든 조건이 AND 관계
  let matchedRules = 0;
  let highestPriorityMatch = false;

  // 우선순위 정렬 (낮은 숫자 = 높은 우선순위)
  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    // 규칙에 조건이 없으면 건너뛰기
    if (!rule.conditions || rule.conditions.length === 0) continue;

    // 모든 조건이 충족되어야 규칙 매치 (AND 관계)
    const allConditionsMet = rule.conditions.every(condition =>
      evaluateCondition(condition, responses)
    );

    if (allConditionsMet) {
      matchedRules++;
      // 첫 번째 매칭 규칙이 가장 높은 우선순위
      if (!highestPriorityMatch) {
        highestPriorityMatch = true;
      }
    }
  }

  // 조건이 있는 규칙만 카운트
  const rulesWithConditions = rules.filter(r => r.conditions && r.conditions.length > 0);
  const totalRules = rulesWithConditions.length;

  // 점수 계산: 매칭된 규칙 비율
  const score = totalRules > 0 ? matchedRules / totalRules : 0;

  return {
    templateId: template.id,
    score,
    matchedRules,
    totalRules,
    isAlwaysInclude: false,
    isManualOnly: false,
  };
}

/**
 * 설문 답변을 기반으로 필요한 템플릿 자동 선택
 *
 * @param responses - 설문 답변 배열
 * @param templates - 전체 템플릿 배열
 * @returns 분류된 템플릿 목록 (required, suggested, optional)
 *
 * 분류 기준:
 * - required: 규칙 100% 충족 (score === 1.0) 또는 "항상 사용" 설정
 * - suggested: 규칙 50% 이상 충족 (score > 0.5)
 * - optional: 그 외 (수동 선택용 포함)
 */
export function selectTemplates(
  responses: SurveyResponse[],
  templates: Template[]
): TemplateSelection {
  const required: Template[] = [];
  const suggested: Template[] = [];
  const optional: Template[] = [];

  // 활성화된 템플릿만 처리
  const activeTemplates = templates.filter(t => t.isActive);

  for (const template of activeTemplates) {
    const evaluation = evaluateRules(template, responses);

    // 항상 사용 → required
    if (evaluation.isAlwaysInclude) {
      required.push(template);
      continue;
    }

    // 수동 선택만 → optional
    if (evaluation.isManualOnly) {
      optional.push(template);
      continue;
    }

    // 규칙이 없는 템플릿 → optional
    if (evaluation.totalRules === 0) {
      optional.push(template);
      continue;
    }

    // 점수 기반 분류
    if (evaluation.score >= 1.0) {
      required.push(template);
    } else if (evaluation.score > 0.5) {
      suggested.push(template);
    } else {
      optional.push(template);
    }
  }

  // 각 카테고리 내에서 이름순 정렬
  const sortByName = (a: Template, b: Template) =>
    (a.displayName || a.name).localeCompare(b.displayName || b.name);

  return {
    required: required.sort(sortByName),
    suggested: suggested.sort(sortByName),
    optional: optional.sort(sortByName),
  };
}

/**
 * 특정 템플릿의 규칙 충족 상세 정보 반환
 * (디버깅 및 UI 표시용)
 */
export function getTemplateEvaluationDetails(
  template: Template,
  responses: SurveyResponse[]
): {
  evaluation: RuleEvaluationResult;
  conditionDetails: Array<{
    ruleIndex: number;
    condition: RuleCondition;
    isMet: boolean;
    actualValue: string | undefined;
  }>;
} {
  const evaluation = evaluateRules(template, responses);
  const conditionDetails: Array<{
    ruleIndex: number;
    condition: RuleCondition;
    isMet: boolean;
    actualValue: string | undefined;
  }> = [];

  const rules = template.rules || [];
  rules.forEach((rule, ruleIndex) => {
    if (!rule.conditions) return;

    rule.conditions.forEach(condition => {
      const response = responses.find(r => r.questionId === condition.questionId);
      const actualValue = response?.value;
      const isMet = evaluateCondition(condition, responses);

      conditionDetails.push({
        ruleIndex,
        condition,
        isMet,
        actualValue: Array.isArray(actualValue) ? actualValue.join(',') : actualValue,
      });
    });
  });

  return { evaluation, conditionDetails };
}

// ============================================
// 변수 미리보기 생성
// ============================================

/**
 * 변수 치환 결과 미리보기 텍스트 생성
 */
export function generatePreviewText(
  templateText: string,
  variables: Record<string, string>
): string {
  let result = templateText;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, value || `[${key}]`);
  }

  return result;
}

// ============================================
// 내보내기
// ============================================

export default {
  // 메인 함수
  transformSurveyToVariables,
  validateVariables,
  generatePreviewText,

  // 템플릿 선택
  selectTemplates,
  evaluateCondition,
  evaluateRules,
  getTemplateEvaluationDetails,

  // 날짜 유틸리티
  formatDate,
  getCurrentDate,
  getCurrentTime,

  // 숫자 유틸리티 (영문)
  numberToEnglish,
  numberToEnglishCurrency,
  numberToOrdinal,
  formatNumberWithComma,

  // 숫자 유틸리티 (한글)
  numberToKorean,
  numberToKoreanCurrency,

  // 문자열 유틸리티
  formatPhone,
  transformText,

  // 문서번호
  generateDocumentNumber,
};
