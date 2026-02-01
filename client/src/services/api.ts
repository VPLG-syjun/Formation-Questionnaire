import { Survey, CreateSurveyDTO, SurveyStats, SurveyAnswer, AdminDates, AdminValues } from '../types/survey';

const API_BASE = '/api';

export async function fetchSurveys(status?: string): Promise<Survey[]> {
  const url = status ? `${API_BASE}/surveys?status=${status}` : `${API_BASE}/surveys`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('설문 목록을 불러오는데 실패했습니다.');
  return response.json();
}

export async function fetchSurvey(id: string): Promise<Survey> {
  const response = await fetch(`${API_BASE}/surveys/${id}`);
  if (!response.ok) throw new Error('설문을 불러오는데 실패했습니다.');
  return response.json();
}

export async function createSurvey(data: CreateSurveyDTO): Promise<{ id: string; message: string }> {
  const response = await fetch(`${API_BASE}/surveys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '설문 제출에 실패했습니다.');
  }
  return response.json();
}

export interface UpdateSurveyData {
  status?: string;
  adminNotes?: string;
  answers?: SurveyAnswer[];
  adminDates?: AdminDates;
  adminValues?: AdminValues;
}

export async function updateSurvey(
  id: string,
  data: UpdateSurveyData
): Promise<{ message: string; survey?: Survey }> {
  const response = await fetch(`${API_BASE}/surveys/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('설문 업데이트에 실패했습니다.');
  return response.json();
}

export async function deleteSurvey(id: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE}/surveys/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('설문 삭제에 실패했습니다.');
  return response.json();
}

export async function generatePDF(id: string): Promise<{ message: string; fileName: string }> {
  const response = await fetch(`${API_BASE}/surveys/${id}/generate-pdf`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('PDF 생성에 실패했습니다.');
  return response.json();
}

export function getDownloadURL(id: string): string {
  return `${API_BASE}/surveys/${id}/download`;
}

export async function fetchStats(): Promise<SurveyStats> {
  const response = await fetch(`${API_BASE}/surveys/stats/overview`);
  if (!response.ok) throw new Error('통계를 불러오는데 실패했습니다.');
  return response.json();
}

// ============================================
// Template & Document Generation APIs
// ============================================

export interface Template {
  id: string;
  name: string;
  displayName: string;
  category: string;
  isActive: boolean;
}

export interface TemplateSelection {
  required: Template[];
  suggested: Template[];
  optional: Template[];
}

export interface DocumentResult {
  templateId: string;
  templateName: string;
  filename: string;
  status: 'success' | 'error';
  error?: string;
  missingVariables?: string[];
}

export interface GenerateDocumentsResponse {
  success: boolean;
  documents: DocumentResult[];
  zipFile: string;
  downloadUrl: string;
  generationId: string;
  stats: {
    total: number;
    successful: number;
    failed: number;
  };
  error?: string;
}

export async function selectTemplates(surveyId: string): Promise<TemplateSelection> {
  const response = await fetch(`${API_BASE}/templates/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ surveyId }),
  });
  if (!response.ok) throw new Error('템플릿 선택에 실패했습니다.');
  return response.json();
}

export async function generateDocuments(
  surveyId: string,
  selectedTemplates: string[],
  overrideVariables?: Record<string, string>
): Promise<GenerateDocumentsResponse> {
  const response = await fetch(`${API_BASE}/admin/generate-documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      surveyId,
      selectedTemplates,
      overrideVariables,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || '문서 생성에 실패했습니다.');
  }

  return data;
}

export function getDocumentDownloadURL(downloadId: string): string {
  return `${API_BASE}/admin/download/${downloadId}`;
}

// Manual Variables for Document Generation
export interface ManualVariable {
  variableName: string;
  dataType: string;
  transformRule: string;
  required: boolean;
  defaultValue?: string;
  usedInTemplates: string[];
}

export interface ManualVariablesResponse {
  variables: ManualVariable[];
  totalCount: number;
  requiredCount: number;
}

export async function getManualVariables(templateIds: string[]): Promise<ManualVariablesResponse> {
  const response = await fetch(`${API_BASE}/templates/variables`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getManual', templateIds }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || '직접 입력 변수 조회에 실패했습니다.');
  }

  return response.json();
}
