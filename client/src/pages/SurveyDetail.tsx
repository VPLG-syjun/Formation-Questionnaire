import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Survey, SurveyAnswer } from '../types/survey';
import { fetchSurvey, updateSurvey } from '../services/api';
import DocumentGenerationModal from '../components/DocumentGenerationModal';

export default function SurveyDetail() {
  const { id } = useParams<{ id: string }>();

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showDocumentModal, setShowDocumentModal] = useState(false);

  // 편집 모드 상태
  const [editingAnswers, setEditingAnswers] = useState(false);
  const [editedAnswers, setEditedAnswers] = useState<SurveyAnswer[]>([]);

  // 관리자 날짜 상태
  const [coiDate, setCoiDate] = useState('');
  const [signDate, setSignDate] = useState('');

  useEffect(() => {
    loadSurvey();
  }, [id]);

  // survey가 로드되면 날짜 상태 초기화
  useEffect(() => {
    if (survey) {
      setCoiDate(survey.adminDates?.COIDate || '');
      setSignDate(survey.adminDates?.SIGNDate || '');
    }
  }, [survey]);

  const loadSurvey = async (showLoading = true) => {
    if (!id) return;

    try {
      if (showLoading && !survey) {
        setLoading(true);
      }
      const data = await fetchSurvey(id);
      setSurvey(data);
      setAdminNotes(data.adminNotes || '');
      setEditedAnswers(data.answers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '설문을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (status: 'approved' | 'rejected') => {
    if (!id) return;

    setIsUpdating(true);
    setMessage({ type: '', text: '' });

    try {
      await updateSurvey(id, { status, adminNotes });
      setMessage({ type: 'success', text: `설문이 ${status === 'approved' ? '승인' : '반려'}되었습니다.` });
      loadSurvey();
    } catch (err) {
      setMessage({ type: 'error', text: '상태 업데이트에 실패했습니다.' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDocumentGenerated = () => {
    loadSurvey(false);
    setMessage({ type: 'success', text: '문서가 성공적으로 생성되었습니다.' });
  };

  // 응답 편집 시작
  const handleStartEditAnswers = () => {
    if (survey) {
      setEditedAnswers([...survey.answers]);
      setEditingAnswers(true);
    }
  };

  // 응답 편집 취소
  const handleCancelEditAnswers = () => {
    if (survey) {
      setEditedAnswers([...survey.answers]);
    }
    setEditingAnswers(false);
  };

  // 개별 응답 수정
  const handleAnswerChange = (index: number, newValue: string | string[]) => {
    const updated = [...editedAnswers];
    updated[index] = { ...updated[index], value: newValue };
    setEditedAnswers(updated);
  };

  // 응답 저장
  const handleSaveAnswers = async () => {
    if (!id) return;

    setIsUpdating(true);
    setMessage({ type: '', text: '' });

    try {
      await updateSurvey(id, { answers: editedAnswers });
      setMessage({ type: 'success', text: '설문 응답이 저장되었습니다.' });
      setEditingAnswers(false);
      loadSurvey(false);
    } catch (err) {
      setMessage({ type: 'error', text: '응답 저장에 실패했습니다.' });
    } finally {
      setIsUpdating(false);
    }
  };

  // 관리자 날짜 저장
  const handleSaveDates = async () => {
    if (!id) return;

    setIsUpdating(true);
    setMessage({ type: '', text: '' });

    try {
      await updateSurvey(id, {
        adminDates: {
          COIDate: coiDate || undefined,
          SIGNDate: signDate || undefined,
        },
      });
      setMessage({ type: 'success', text: '날짜가 저장되었습니다.' });
      loadSurvey(false);
    } catch (err) {
      setMessage({ type: 'error', text: '날짜 저장에 실패했습니다.' });
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

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { class: string; text: string }> = {
      pending: { class: 'status-pending', text: '검토 대기' },
      approved: { class: 'status-approved', text: '승인됨' },
      rejected: { class: 'status-rejected', text: '반려됨' },
    };
    const { class: className, text } = statusMap[status] || statusMap.pending;
    return <span className={`status-badge ${className}`}>{text}</span>;
  };

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  if (error || !survey) {
    return (
      <div className="card">
        <div className="message message-error">{error || '설문을 찾을 수 없습니다.'}</div>
        <Link to="/admin" className="btn btn-secondary">목록으로</Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/admin" className="btn btn-outline">
          &larr; 목록으로
        </Link>
      </div>

      {message.text && (
        <div className={`message message-${message.type}`}>{message.text}</div>
      )}

      <div className="card">
        <h2>설문 상세 정보</h2>

        {/* Customer Info */}
        <div className="detail-section">
          <h3>고객 정보</h3>
          <div className="detail-row">
            <span className="detail-label">이름</span>
            <span className="detail-value">{survey.customerInfo?.name || '-'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">이메일</span>
            <span className="detail-value">{survey.customerInfo?.email || '-'}</span>
          </div>
          {survey.customerInfo?.phone && (
            <div className="detail-row">
              <span className="detail-label">연락처</span>
              <span className="detail-value">{survey.customerInfo.phone}</span>
            </div>
          )}
          {survey.customerInfo?.company && (
            <div className="detail-row">
              <span className="detail-label">회사명</span>
              <span className="detail-value">{survey.customerInfo.company}</span>
            </div>
          )}
        </div>

        {/* Status Info */}
        <div className="detail-section">
          <h3>상태 정보</h3>
          <div className="detail-row">
            <span className="detail-label">상태</span>
            <span className="detail-value">{getStatusBadge(survey.status)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">예상 금액</span>
            <span className="detail-value" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
              {formatPrice(survey.totalPrice || 0)}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">제출일</span>
            <span className="detail-value">{formatDate(survey.createdAt)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">검토일</span>
            <span className="detail-value">{formatDate(survey.reviewedAt)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">문서 생성일</span>
            <span className="detail-value">{formatDate(survey.documentGeneratedAt)}</span>
          </div>
        </div>

        {/* Survey Answers */}
        <div className="detail-section">
          <div className="section-header">
            <h3>설문 응답</h3>
            {!editingAnswers ? (
              <button
                className="btn btn-sm btn-outline"
                onClick={handleStartEditAnswers}
              >
                편집
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={handleCancelEditAnswers}
                  disabled={isUpdating}
                >
                  취소
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={handleSaveAnswers}
                  disabled={isUpdating}
                >
                  {isUpdating ? '저장 중...' : '저장'}
                </button>
              </div>
            )}
          </div>

          {editingAnswers ? (
            // 편집 모드
            <div className="answers-edit-list">
              {editedAnswers.map((answer, index) => (
                <div key={index} className="answer-edit-item">
                  <label className="answer-edit-label">{answer.questionId}</label>
                  {Array.isArray(answer.value) ? (
                    <textarea
                      className="answer-edit-input"
                      value={answer.value.join('\n')}
                      onChange={(e) =>
                        handleAnswerChange(
                          index,
                          e.target.value.split('\n').filter((v) => v.trim())
                        )
                      }
                      rows={3}
                      placeholder="각 줄에 하나씩 입력"
                    />
                  ) : (
                    <input
                      type="text"
                      className="answer-edit-input"
                      value={answer.value}
                      onChange={(e) => handleAnswerChange(index, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            // 보기 모드
            survey.answers?.map((answer, index) => (
              <div key={index} className="question-card">
                <h4>{answer.questionId}</h4>
                <p style={{ marginTop: '10px', color: '#374151' }}>
                  {Array.isArray(answer.value) ? answer.value.join(', ') : answer.value}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Admin Dates - COIDate & SIGNDate */}
        <div className="detail-section">
          <h3>문서 생성 날짜 설정</h3>
          <p className="section-description">
            문서 생성 시 사용될 날짜를 설정합니다. 설정하지 않으면 문서 생성 시점의 날짜가 사용됩니다.
          </p>

          <div className="admin-dates-grid">
            <div className="admin-date-field">
              <label>COIDate (Certificate of Incorporation)</label>
              <input
                type="date"
                value={coiDate}
                onChange={(e) => setCoiDate(e.target.value)}
                className="date-input"
              />
              {coiDate && (
                <span className="date-preview">
                  {new Date(coiDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              )}
            </div>

            <div className="admin-date-field">
              <label>SIGNDate (서명 날짜)</label>
              <input
                type="date"
                value={signDate}
                onChange={(e) => setSignDate(e.target.value)}
                className="date-input"
              />
              {signDate && (
                <span className="date-preview">
                  {new Date(signDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              )}
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <button
              className="btn btn-primary"
              onClick={handleSaveDates}
              disabled={isUpdating}
            >
              {isUpdating ? '저장 중...' : '날짜 저장'}
            </button>
            {(survey.adminDates?.COIDate || survey.adminDates?.SIGNDate) && (
              <span className="saved-indicator" style={{ marginLeft: '12px' }}>
                ✓ 저장됨
              </span>
            )}
          </div>
        </div>

        {/* Admin Actions */}
        <div className="detail-section">
          <h3>관리자 액션</h3>

          <div className="form-group">
            <label>관리자 메모</label>
            <textarea
              value={adminNotes}
              onChange={e => setAdminNotes(e.target.value)}
              placeholder="메모를 입력하세요..."
              rows={3}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-success"
              onClick={() => handleStatusUpdate('approved')}
              disabled={isUpdating || survey.status === 'approved'}
            >
              {isUpdating ? '처리 중...' : '승인하기'}
            </button>

            <button
              className="btn btn-danger"
              onClick={() => handleStatusUpdate('rejected')}
              disabled={isUpdating || survey.status === 'rejected'}
            >
              {isUpdating ? '처리 중...' : '반려하기'}
            </button>

            <button
              className="btn btn-primary"
              onClick={() => setShowDocumentModal(true)}
              disabled={survey.status !== 'approved'}
              title={survey.status !== 'approved' ? '승인된 설문만 문서 생성이 가능합니다' : ''}
            >
              📄 문서 생성
            </button>

            {survey.documentGeneratedAt && (
              <span className="doc-generated-badge">
                ✅ 문서 생성됨 ({formatDate(survey.documentGeneratedAt)})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Document Generation Modal */}
      <DocumentGenerationModal
        isOpen={showDocumentModal}
        onClose={() => setShowDocumentModal(false)}
        surveyId={survey.id}
        onComplete={handleDocumentGenerated}
      />
    </div>
  );
}
