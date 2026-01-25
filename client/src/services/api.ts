import { Survey, CreateSurveyDTO, SurveyStats } from '../types/survey';

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

export async function updateSurvey(
  id: string,
  data: { status?: string; admin_notes?: string }
): Promise<{ message: string }> {
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
