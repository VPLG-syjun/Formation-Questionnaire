import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Survey } from '../types/survey';
import { fetchSurvey, updateSurvey, generatePDF, getDownloadURL } from '../services/api';

export default function SurveyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadSurvey();
  }, [id]);

  const loadSurvey = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const data = await fetchSurvey(id);
      setSurvey(data);
      setAdminNotes(data.admin_notes || '');
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
      await updateSurvey(id, { status, admin_notes: adminNotes });
      setMessage({ type: 'success', text: `설문이 ${status === 'approved' ? '승인' : '반려'}되었습니다.` });
      loadSurvey();
    } catch (err) {
      setMessage({ type: 'error', text: '상태 업데이트에 실패했습니다.' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!id) return;

    setIsGeneratingPDF(true);
    setMessage({ type: '', text: '' });

    try {
      await generatePDF(id);
      setMessage({ type: 'success', text: 'PDF 문서가 생성되었습니다.' });
      loadSurvey();
    } catch (err) {
      setMessage({ type: 'error', text: 'PDF 생성에 실패했습니다.' });
    } finally {
      setIsGeneratingPDF(false);
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
            <span className="detail-value">{survey.customer_name}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">이메일</span>
            <span className="detail-value">{survey.customer_email}</span>
          </div>
          {survey.customer_phone && (
            <div className="detail-row">
              <span className="detail-label">연락처</span>
              <span className="detail-value">{survey.customer_phone}</span>
            </div>
          )}
          {survey.company_name && (
            <div className="detail-row">
              <span className="detail-label">회사명</span>
              <span className="detail-value">{survey.company_name}</span>
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
            <span className="detail-label">제출일</span>
            <span className="detail-value">{formatDate(survey.created_at)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">검토일</span>
            <span className="detail-value">{formatDate(survey.reviewed_at)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">문서 생성일</span>
            <span className="detail-value">{formatDate(survey.document_generated_at)}</span>
          </div>
        </div>

        {/* Survey Responses */}
        <div className="detail-section">
          <h3>설문 응답</h3>
          {survey.responses.map((response, index) => (
            <div key={index} className="question-card">
              <h4>Q{index + 1}. {response.question}</h4>
              <p style={{ marginTop: '10px', color: '#374151' }}>{response.answer}</p>
            </div>
          ))}
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
              onClick={handleGeneratePDF}
              disabled={isGeneratingPDF || survey.status !== 'approved'}
              title={survey.status !== 'approved' ? '승인된 설문만 문서 생성이 가능합니다' : ''}
            >
              {isGeneratingPDF ? 'PDF 생성 중...' : 'PDF 문서 생성'}
            </button>

            {survey.document_generated_at && (
              <a
                href={getDownloadURL(survey.id)}
                className="btn btn-secondary"
                download
              >
                PDF 다운로드
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
