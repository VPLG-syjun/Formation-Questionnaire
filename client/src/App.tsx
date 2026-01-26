import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import SurveyForm from './pages/SurveyForm';
import AdminDashboard from './pages/AdminDashboard';
import SurveyDetail from './pages/SurveyDetail';
import SubmitSuccess from './pages/SubmitSuccess';

function Navigation() {
  const location = useLocation();

  return (
    <header className="header">
      <div className="container">
        <h1>Formation Questionnaire</h1>
        <nav>
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
            설문 작성
          </Link>
          <Link to="/admin" className={location.pathname.startsWith('/admin') ? 'active' : ''}>
            관리자 대시보드
          </Link>
        </nav>
      </div>
    </header>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Navigation />
      <main className="container">
        <Routes>
          <Route path="/" element={<SurveyForm />} />
          <Route path="/success" element={<SubmitSuccess />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/survey/:id" element={<SurveyDetail />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
