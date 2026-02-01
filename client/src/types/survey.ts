// 질문 유형 정의
export type QuestionType = 'text' | 'email' | 'tel' | 'number' | 'date' | 'yesno' | 'dropdown' | 'radio' | 'checkbox';

// 선택 옵션 (dropdown, radio, checkbox용)
export interface QuestionOption {
  value: string;
  label: string;
  price?: number; // 이 옵션 선택 시 추가 금액
}

// 조건부 표시 규칙
export interface ConditionalRule {
  questionId: string; // 의존하는 질문 ID
  values: string[];   // 해당 값일 때만 표시
}

// 질문 정의
export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  description?: string;      // 질문 설명
  placeholder?: string;
  required: boolean;
  options?: QuestionOption[]; // dropdown, radio, checkbox용
  conditionalOn?: ConditionalRule; // 조건부 표시
  priceEffect?: {             // 가격에 영향
    type: 'fixed' | 'perAnswer';
    values?: Record<string, number>; // 답변별 금액
  };
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
  documentField?: string; // DOCX 템플릿에서 사용할 필드명
}

// 질문 그룹 (섹션)
export interface QuestionSection {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
}

// 설문 응답
export interface SurveyAnswer {
  questionId: string;
  value: string | string[];
  price?: number;
}

// 관리자가 설정하는 날짜 변수
export interface AdminDates {
  COIDate?: string;   // Certificate of Incorporation 날짜
  SIGNDate?: string;  // 서명 날짜
}

// 설문 제출 데이터
export interface Survey {
  id: string;
  customerInfo: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
  };
  answers: SurveyAnswer[];
  totalPrice: number;
  status: 'pending' | 'approved' | 'rejected';
  adminNotes?: string;
  adminDates?: AdminDates;  // 관리자가 설정하는 날짜들
  createdAt: string;
  reviewedAt?: string;
  documentGeneratedAt?: string;
}

export interface CreateSurveyDTO {
  customerInfo: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
  };
  answers: SurveyAnswer[];
  totalPrice: number;
}

export interface SurveyStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  totalRevenue: number;
}
