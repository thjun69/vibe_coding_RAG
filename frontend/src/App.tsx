import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import ChatPage from './pages/ChatPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { isAuthenticated } from './services/api';

// 인증이 필요한 라우트를 보호하는 컴포넌트 (업로드, 채팅만 보호)
const ProtectedRoute: React.FC<{ children: React.ReactNode; requireAuth?: boolean }> = ({ 
  children, 
  requireAuth = true 
}) => {
  const location = useLocation();
  
  // 데모 모드인 경우 인증 없이도 접근 허용
  if (location.pathname === '/chat' && location.search.includes('demo=true')) {
    return <>{children}</>;
  }
  
  if (requireAuth && !isAuthenticated()) {
    // 로그인하지 않은 경우 로그인 페이지로 리다이렉트
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return <>{children}</>;
};

// 인증된 사용자는 접근할 수 없는 라우트 (로그인, 회원가입)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (isAuthenticated()) {
    // 이미 로그인한 경우 홈페이지로 리다이렉트
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

const App: React.FC = () => {
  const location = useLocation();
  const isAuthPage = ['/login', '/register'].includes(location.pathname);
  
  // 라우트 변경 감지 로그
  console.log('🔄 App.tsx - 라우트 변경됨:', {
    pathname: location.pathname,
    search: location.search,
    hash: location.hash,
    fullUrl: location.pathname + location.search + location.hash
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 인증 페이지가 아닌 경우에만 헤더 표시 */}
      {!isAuthPage && <Header />}
      <main>
        <Routes>
          {/* 공개 라우트 (인증 필요 없음) */}
          <Route path="/login" element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } />
          <Route path="/register" element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          } />
          
          {/* 홈페이지는 누구나 접근 가능 */}
          <Route path="/" element={<HomePage />} />
          
          {/* 인증이 필요한 라우트 */}
          <Route path="/upload" element={
            <ProtectedRoute>
              <UploadPage />
            </ProtectedRoute>
          } />
          <Route path="/chat" element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          } />
          
          {/* 기본 리다이렉트 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export default App;
