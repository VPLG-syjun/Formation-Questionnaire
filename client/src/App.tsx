import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import SurveyForm from './pages/SurveyForm';
import AdminDashboard from './pages/AdminDashboard';
import SurveyDetail from './pages/SurveyDetail';
import SubmitSuccess from './pages/SubmitSuccess';
import AdminLogin from './pages/AdminLogin';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

function Navigation() {
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();

  // 로그인 페이지에서는 헤더 숨김
  if (location.pathname === '/admin/login') {
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
          <Link to="/admin" className={location.pathname.startsWith('/admin') ? 'active' : ''}>
            관리자 대시보드
          </Link>
          {isAuthenticated && (
            <button onClick={logout} className="logout-button">
              로그아웃
            </button>
          )}
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
        <main className="container">
          <Routes>
            <Route path="/" element={<SurveyForm />} />
            <Route path="/success" element={<SubmitSuccess />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/survey/:id"
              element={
                <ProtectedRoute>
                  <SurveyDetail />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
