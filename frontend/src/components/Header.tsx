import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bot, Home, Upload, MessageSquare, User, LogIn, UserPlus, LogOut, ChevronDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUser, logoutUser, isAuthenticated } from '../services/api';
import { User as UserType } from '../types';

const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navItems = [
    { path: '/', label: '홈', icon: Home },
    { path: '/upload', label: '업로드', icon: Upload },
  ];

  const isActive = (path: string) => location.pathname === path;

  // 현재 사용자 정보 조회
  const { data: currentUser, isLoading } = useQuery<UserType>({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    enabled: isAuthenticated(),
    retry: false,
  });

  const handleLogout = async () => {
    try {
      await logoutUser();
      // 로그아웃 후 메인화면으로 이동
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
      // 로그아웃 실패해도 클라이언트 토큰은 제거되므로 메인화면으로 이동
      navigate('/');
    }
  };

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showUserMenu) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showUserMenu]);

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* 로고 */}
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">ResearchBot</h1>
              <p className="text-xs text-gray-500">AI 논문 분석 챗봇</p>
            </div>
          </Link>

          {/* 네비게이션 */}
          <nav className="flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200
                    ${isActive(item.path)
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* 우측 메뉴 */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <MessageSquare className="w-4 h-4" />
              <span>AI 논문 분석</span>
            </div>

            {/* 사용자 메뉴 */}
            {isAuthenticated() ? (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowUserMenu(!showUserMenu);
                  }}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div className="hidden md:block text-left">
                    {isLoading ? (
                      <div className="text-xs text-gray-500">로딩중...</div>
                    ) : currentUser ? (
                      <>
                        <div className="font-medium">{currentUser.username}</div>
                        <div className="text-xs text-gray-500">{currentUser.email}</div>
                      </>
                    ) : (
                      <div className="text-xs text-gray-500">사용자</div>
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4" />
                </button>

                {/* 로그인된 사용자 드롭다운 메뉴 */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1">
                      {currentUser && (
                        <div className="px-4 py-3 border-b border-gray-200">
                          <div className="text-sm font-medium text-gray-900">
                            {currentUser.full_name || currentUser.username}
                          </div>
                          <div className="text-sm text-gray-500">{currentUser.email}</div>
                        </div>
                      )}
                      <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                      >
                        <LogOut className="w-4 h-4 mr-3" />
                        로그아웃
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* 비회원 로그인/회원가입 버튼 */
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>로그인</span>
                </Link>
                <Link
                  to="/register"
                  className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>회원가입</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
