import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSurvey } from '../services/api';

const SURVEY_QUESTIONS = [
  '현재 사용하고 계신 서비스에 대해 어떻게 알게 되셨나요?',
  '서비스를 이용하시면서 가장 만족스러운 점은 무엇인가요?',
  '서비스 개선이 필요하다고 생각하시는 부분이 있다면 말씀해주세요.',
  '추가로 원하시는 기능이나 서비스가 있으신가요?',
  '서비스를 다른 분들께 추천하실 의향이 있으신가요? 그 이유는 무엇인가요?',
];

export default function SurveyForm() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    company_name: '',
    answers: SURVEY_QUESTIONS.map(() => ''),
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAnswerChange = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      answers: prev.answers.map((a, i) => (i === index ? value : a)),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.customer_name || !formData.customer_email) {
      setError('이름과 이메일은 필수 입력 항목입니다.');
      return;
    }

    const emptyAnswers = formData.answers.filter(a => !a.trim()).length;
    if (emptyAnswers > 0) {
      setError('모든 설문 질문에 답변해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      const responses = SURVEY_QUESTIONS.map((question, index) => ({
        question,
        answer: formData.answers[index],
      }));

      await createSurvey({
        customer_name: formData.customer_name,
        customer_email: formData.customer_email,
        customer_phone: formData.customer_phone || undefined,
        company_name: formData.company_name || undefined,
        responses,
      });

      navigate('/success');
    } catch (err) {
      setError(err instanceof Error ? err.message : '설문 제출에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="card">
        <h2>고객 설문조사</h2>
        <p style={{ color: '#6b7280', marginBottom: '20px' }}>
          소중한 의견을 남겨주시면 서비스 개선에 반영하겠습니다.
        </p>

        {error && <div className="message message-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
            <div className="form-group">
              <label>이름 *</label>
              <input
                type="text"
                value={formData.customer_name}
                onChange={e => handleInputChange('customer_name', e.target.value)}
                placeholder="홍길동"
              />
            </div>

            <div className="form-group">
              <label>이메일 *</label>
              <input
                type="email"
                value={formData.customer_email}
                onChange={e => handleInputChange('customer_email', e.target.value)}
                placeholder="example@email.com"
              />
            </div>

            <div className="form-group">
              <label>연락처</label>
              <input
                type="tel"
                value={formData.customer_phone}
                onChange={e => handleInputChange('customer_phone', e.target.value)}
                placeholder="010-1234-5678"
              />
            </div>

            <div className="form-group">
              <label>회사명</label>
              <input
                type="text"
                value={formData.company_name}
                onChange={e => handleInputChange('company_name', e.target.value)}
                placeholder="회사명 (선택)"
              />
            </div>
          </div>

          <div className="survey-questions">
            <h3 style={{ marginBottom: '20px', color: '#1f2937' }}>설문 질문</h3>

            {SURVEY_QUESTIONS.map((question, index) => (
              <div key={index} className="question-card">
                <h4>Q{index + 1}. {question}</h4>
                <textarea
                  value={formData.answers[index]}
                  onChange={e => handleAnswerChange(index, e.target.value)}
                  placeholder="답변을 입력해주세요..."
                  rows={3}
                />
              </div>
            ))}
          </div>

          <div style={{ marginTop: '30px', textAlign: 'center' }}>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? '제출 중...' : '설문 제출하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
