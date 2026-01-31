import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Survey, SurveyStats } from '../types/survey';
import { fetchSurveys, fetchStats, deleteSurvey } from '../services/api';

export default function AdminDashboard() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [stats, setStats] = useState<SurveyStats | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogout = () => {
    sessionStorage.removeItem('adminAuth');
    navigate('/admin/login');
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [surveysData, statsData] = await Promise.all([
        fetchSurveys(filter || undefined),
        fetchStats(),
      ]);
      setSurveys(surveysData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filter]);

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      await deleteSurvey(id);
      loadData();
    } catch (err) {
      alert('삭제에 실패했습니다.');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
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

  if (error) {
    return <div className="message message-error">{error}</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <h2 style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
          관리자 대시보드
        </h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link to="/admin/templates" className="btn btn-secondary">
            템플릿 관리
          </Link>
          <button onClick={handleLogout} className="btn btn-outline">
            로그아웃
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card primary">
            <div className="stat-label">전체 설문</div>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">검토 대기</div>
            <div className="stat-value" style={{ color: 'var(--color-warning)' }}>{stats.pending}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">승인됨</div>
            <div className="stat-value" style={{ color: 'var(--color-success)' }}>{stats.approved}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">총 매출</div>
            <div className="stat-value" style={{ color: 'var(--color-primary)', fontSize: '1.5rem' }}>
              {formatPrice(stats.totalRevenue || 0)}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="filter-tabs">
          <button
            className={`filter-tab ${filter === '' ? 'active' : ''}`}
            onClick={() => setFilter('')}
          >
            전체
          </button>
          <button
            className={`filter-tab ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            검토 대기
          </button>
          <button
            className={`filter-tab ${filter === 'approved' ? 'active' : ''}`}
            onClick={() => setFilter('approved')}
          >
            승인됨
          </button>
          <button
            className={`filter-tab ${filter === 'rejected' ? 'active' : ''}`}
            onClick={() => setFilter('rejected')}
          >
            반려됨
          </button>
        </div>

        {/* Survey List */}
        {surveys.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3 style={{ marginBottom: '8px', color: 'var(--color-gray-700)' }}>설문이 없습니다</h3>
            <p>아직 제출된 설문이 없습니다.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>이메일</th>
                  <th>회사명</th>
                  <th>예상 금액</th>
                  <th>상태</th>
                  <th>제출일</th>
                  <th>액션</th>
                </tr>
              </thead>
              <tbody>
                {surveys.map(survey => (
                  <tr key={survey.id}>
                    <td style={{ fontWeight: 500 }}>{survey.customerInfo?.email || '-'}</td>
                    <td>{survey.customerInfo?.company || '-'}</td>
                    <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                      {formatPrice(survey.totalPrice || 0)}
                    </td>
                    <td>{getStatusBadge(survey.status)}</td>
                    <td style={{ color: 'var(--color-gray-500)', fontSize: '0.9rem' }}>
                      {formatDate(survey.createdAt)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Link to={`/admin/survey/${survey.id}`} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                          상세보기
                        </Link>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                          onClick={() => handleDelete(survey.id)}
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
