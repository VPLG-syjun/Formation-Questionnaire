import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import SurveyForm from './pages/SurveyForm';
import AdminDashboard from './pages/AdminDashboard';
import SurveyDetail from './pages/SurveyDetail';
import SubmitSuccess from './pages/SubmitSuccess';
import AdminLogin from './pages/AdminLogin';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';

function Navigation() {
  const location = useLocation();

  // 관리자 영역에서는 Navigation 숨김 (AdminLayout 사용)
  if (location.pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <header className="header">
      <div className="container">
        <img src="/logo.png" alt="Logo" className="header-logo" />
        <h1>Formation Questionnaire</h1>
        <nav>
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
            설문 작성
          </Link>
          <Link to="/admin/dashboard" className="admin-link">
            관리자
          </Link>
        </nav>
      </div>
    </header>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navigation />
        <Routes>
          {/* 공개 페이지 */}
          <Route path="/" element={<main className="container"><SurveyForm /></main>} />
          <Route path="/success" element={<main className="container"><SubmitSuccess /></main>} />

          {/* 관리자 로그인 */}
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* 관리자 영역 (AdminLayout 사용) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="survey/:id" element={<SurveyDetail />} />
            <Route path="stats" element={<div className="coming-soon">통계 페이지 (준비 중)</div>} />
            <Route path="settings" element={<div className="coming-soon">설정 페이지 (준비 중)</div>} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
