import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AdminLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div className="admin-layout">
      {/* 상단 헤더 */}
      <header className="admin-header">
        <div className="admin-header-left">
          <img src="/logo.png" alt="Logo" className="admin-logo" />
          <h1>관리자 대시보드</h1>
        </div>
        <button onClick={handleLogout} className="btn-logout">
          로그아웃
        </button>
      </header>

      <div className="admin-body">
        {/* 사이드바 */}
        <aside className="admin-sidebar">
          <nav className="sidebar-nav">
            <NavLink
              to="/admin/dashboard"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-icon">📋</span>
              설문 관리
            </NavLink>
            <NavLink
              to="/admin/stats"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-icon">📊</span>
              통계
            </NavLink>
            <NavLink
              to="/admin/settings"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-icon">⚙️</span>
              설정
            </NavLink>
          </nav>
        </aside>

        {/* 메인 콘텐츠 영역 */}
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
