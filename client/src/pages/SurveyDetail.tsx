import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Survey } from '../types/survey';
import { fetchSurvey, updateSurvey } from '../services/api';
import { questionSections } from '../data/questions';

// 질문 ID로 질문 텍스트 찾기
const getQuestionText = (questionId: string): string => {
  for (const section of questionSections) {
    const question = section.questions.find(q => q.id === questionId);
    if (question) return question.text;
  }
  return questionId;
};

// 질문이 속한 섹션 찾기
const getQuestionSection = (questionId: string): string => {
  for (const section of questionSections) {
    const question = section.questions.find(q => q.id === questionId);
    if (question) return section.title;
  }
  return '기타';
};

// 답변값 포맷팅 (yes/no 등)
const formatAnswerValue = (value: string | string[]): string => {
  if (Array.isArray(value)) {
    return value.join(', ');
  }

  const valueMap: Record<string, string> = {
    'yes': '예',
    'no': '아니오',
    'accept': '동의',
    'deny': '거절',
    'llc': 'LLC (유한책임회사)',
    'corp': 'Corporation (주식회사)',
  };

  return valueMap[value] || value;
};

export default function SurveyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSurvey();
  }, [id]);

  const loadSurvey = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const data = await fetchSurvey(id);
      setSurvey(data);
      setAdminNotes(data.adminNotes || '');

      // 모든 섹션 기본 펼침
      const sections = new Set<string>();
      data.answers?.forEach(answer => {
        sections.add(getQuestionSection(answer.questionId));
      });
      setExpandedSections(sections);
    } catch (err) {
      setError(err instanceof Error ? err.message : '설문을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (status: 'approved' | 'rejected') => {
    if (!id) return;

    const statusText = status === 'approved' ? '승인' : '거절';
    if (!confirm(`이 설문을 ${statusText}하시겠습니까?`)) return;

    setIsUpdating(true);

    try {
      await updateSurvey(id, { status, adminNotes });
      alert(`설문이 ${statusText}되었습니다.`);
      navigate('/admin/dashboard');
    } catch (err) {
      alert('상태 업데이트에 실패했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (amount: number) => {
    return '$' + amount.toLocaleString();
  };

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { class: string; text: string; icon: string }> = {
      pending: { class: 'status-pending', text: '대기중', icon: '⏳' },
      approved: { class: 'status-approved', text: '승인됨', icon: '✓' },
      rejected: { class: 'status-rejected', text: '거절됨', icon: '✗' },
    };
    return statusMap[status] || statusMap.pending;
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // 답변을 섹션별로 그룹화
  const groupAnswersBySection = () => {
    const grouped: Record<string, Array<{ questionId: string; value: string | string[]; questionText: string; index: number }>> = {};
    let index = 1;

    survey?.answers?.forEach(answer => {
      const section = getQuestionSection(answer.questionId);
      if (!grouped[section]) {
        grouped[section] = [];
      }
      grouped[section].push({
        ...answer,
        questionText: getQuestionText(answer.questionId),
        index: index++,
      });
    });

    return grouped;
  };

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  if (error || !survey) {
    return (
      <div className="detail-error">
        <div className="error-icon">⚠️</div>
        <h3>{error || '설문을 찾을 수 없습니다.'}</h3>
        <button onClick={() => navigate('/admin/dashboard')} className="btn btn-primary">
          대시보드로 돌아가기
        </button>
      </div>
    );
  }

  const statusInfo = getStatusInfo(survey.status);
  const groupedAnswers = groupAnswersBySection();

  return (
    <div className="survey-detail">
      {/* 헤더 */}
      <div className="detail-header">
        <button onClick={() => navigate('/admin/dashboard')} className="btn-back">
          ← 목록으로
        </button>
        <div className={`status-badge-large ${statusInfo.class}`}>
          <span className="status-icon">{statusInfo.icon}</span>
          {statusInfo.text}
        </div>
      </div>

      {/* 고객 정보 카드 */}
      <div className="info-card">
        <div className="info-card-header">
          <h3>📋 고객 정보</h3>
        </div>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">고객명</span>
            <span className="info-value">{survey.customerInfo?.name || '-'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">이메일</span>
            <span className="info-value">{survey.customerInfo?.email || '-'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">연락처</span>
            <span className="info-value">{survey.customerInfo?.phone || '-'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">회사명</span>
            <span className="info-value">{survey.customerInfo?.company || '-'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">제출일시</span>
            <span className="info-value">{formatDate(survey.createdAt)}</span>
          </div>
          <div className="info-item highlight">
            <span className="info-label">예상 금액</span>
            <span className="info-value price">{formatPrice(survey.totalPrice || 0)}</span>
          </div>
        </div>
      </div>

      {/* 설문 응답 - 아코디언 */}
      <div className="answers-section">
        <h3>📝 설문 응답</h3>

        {Object.entries(groupedAnswers).map(([section, answers]) => (
          <div key={section} className="answer-accordion">
            <button
              className={`accordion-header ${expandedSections.has(section) ? 'expanded' : ''}`}
              onClick={() => toggleSection(section)}
            >
              <span className="accordion-title">{section}</span>
              <span className="accordion-count">{answers.length}개 항목</span>
              <span className="accordion-icon">{expandedSections.has(section) ? '▼' : '▶'}</span>
            </button>

            {expandedSections.has(section) && (
              <div className="accordion-content">
                {answers.map((answer) => (
                  <div key={answer.questionId} className="answer-card">
                    <div className="answer-number">Q{answer.index}</div>
                    <div className="answer-body">
                      <div className="answer-question">{answer.questionText}</div>
                      <div className="answer-value">{formatAnswerValue(answer.value)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 관리자 메모 */}
      <div className="admin-notes-section">
        <h3>💬 관리자 메모</h3>
        <textarea
          value={adminNotes}
          onChange={e => setAdminNotes(e.target.value)}
          placeholder="메모를 입력하세요..."
          rows={3}
          className="admin-notes-input"
        />
      </div>

      {/* 액션 버튼 */}
      <div className="action-bar">
        <button
          onClick={() => navigate('/admin/dashboard')}
          className="btn btn-secondary btn-lg"
        >
          ← 뒤로가기
        </button>

        <div className="action-buttons-right">
          {survey.status === 'pending' && (
            <>
              <button
                className="btn btn-danger btn-lg"
                onClick={() => handleStatusUpdate('rejected')}
                disabled={isUpdating}
              >
                {isUpdating ? '처리 중...' : '✗ 거절'}
              </button>
              <button
                className="btn btn-success btn-lg"
                onClick={() => handleStatusUpdate('approved')}
                disabled={isUpdating}
              >
                {isUpdating ? '처리 중...' : '✓ 승인'}
              </button>
            </>
          )}

          {survey.status !== 'pending' && (
            <div className="status-message">
              이미 {statusInfo.text} 상태입니다
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
