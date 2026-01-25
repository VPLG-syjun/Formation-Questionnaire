export interface SurveyResponse {
  question: string;
  answer: string;
}

export interface Survey {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  company_name?: string;
  responses: SurveyResponse[];
  status: 'pending' | 'approved' | 'rejected';
  admin_notes?: string;
  created_at: string;
  reviewed_at?: string;
  document_generated_at?: string;
}

export interface CreateSurveyDTO {
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  company_name?: string;
  responses: SurveyResponse[];
}

export interface SurveyStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}
