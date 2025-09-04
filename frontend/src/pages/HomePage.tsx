import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Upload, MessageSquare, Search, Zap, LogIn, UserPlus, X } from 'lucide-react';
import ExistingFilesList from '../components/ExistingFilesList';
import { isAuthenticated } from '../services/api';

const HomePage: React.FC = () => {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleFeatureClick = (featureName: string) => {
    console.log('🔍 handleFeatureClick called with:', featureName);
    console.log('🔍 isAuthenticated():', isAuthenticated());
    
    if (featureName === 'demo') {
      console.log('🚀 Demo feature selected, calling handleDemoStart');
      // 데모 기능은 로그인 없이도 사용 가능
      handleDemoStart();
    } else if (!isAuthenticated()) {
      console.log('🔒 Feature requires authentication, showing login modal');
      setShowLoginModal(true);
    } else {
      console.log('✅ Feature allowed for authenticated user');
    }
  };

  const handleDemoStart = () => {
    console.log('🚀 handleDemoStart called');
    // 데모용 샘플 문서로 채팅 페이지 이동
    const demoDocumentId = 'demo_sample_paper';
    const targetUrl = `/chat?document=${demoDocumentId}&demo=true`;
    console.log('🔗 Navigating to demo chat:', targetUrl);
    
    try {
      navigate(targetUrl);
      console.log('✅ Demo navigation successful');
    } catch (error) {
      console.error('❌ Demo navigation failed:', error);
    }
  };

  const handleDocumentSelect = (documentId: string) => {
    console.log('🏠 HomePage handleDocumentSelect called with:', documentId);
    console.log('🏠 navigate function type:', typeof navigate);
    console.log('🏠 현재 location:', window.location.href);
    
    setSelectedDocumentId(documentId);
    
    // documentId가 콤마로 구분된 여러 ID인지 확인
    const documentIds = documentId.includes(',') ? documentId.split(',') : [documentId];
    
    let targetUrl: string;
    if (documentIds.length > 1) {
      // 멀티 문서인 경우
      const queryParams = documentIds.map(id => `documents=${id}`).join('&');
      targetUrl = `/chat?${queryParams}`;
      console.log('🔗 HomePage navigating to (multi):', targetUrl);
    } else {
      // 단일 문서인 경우
      targetUrl = `/chat?document=${documentId}`;
      console.log('🔗 HomePage navigating to (single):', targetUrl);
    }
    
    try {
      navigate(targetUrl);
      console.log('✅ HomePage 네비게이션 호출 완료');
      
      // 잠시 후 URL 변경 확인
      setTimeout(() => {
        console.log('🔄 네비게이션 후 location:', window.location.href);
      }, 100);
    } catch (error) {
      console.error('❌ HomePage 네비게이션 실패:', error);
    }
  };

  const LoginPromptModal = () => (
    showLoginModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md mx-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">로그인이 필요합니다</h3>
            <button
              onClick={() => setShowLoginModal(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-gray-600 mb-6">
            이 기능을 사용하려면 로그인이 필요합니다. 
            계정이 없으시다면 무료로 회원가입하실 수 있습니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/login"
              className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <LogIn className="w-4 h-4 mr-2" />
              로그인
            </Link>
            <Link
              to="/register"
              className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              회원가입
            </Link>
          </div>
        </div>
      </div>
    )
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* 3:1 비율 메인 레이아웃 */}
      <div className="flex min-h-screen">
        {/* 왼쪽 메인 콘텐츠 (로그인 시 3/4, 비회원 시 전체) */}
        <div className={`flex-1 ${isAuthenticated() ? 'w-3/4' : 'w-full'}`}>
          {/* Hero Section */}
          <div className="bg-white shadow-sm border-b">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
              <div className="text-center">
                <div className="flex justify-center mb-6">
                  <div className="bg-blue-100 p-4 rounded-full">
                    <FileText className="h-12 w-12 text-blue-600" />
                  </div>
                </div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">
                  ResearchBot
                </h1>
                <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                  AI 논문 분석 챗봇으로 복잡한 연구 논문을 쉽게 이해하고 분석하세요.
                  PDF 업로드 한 번으로 논문의 핵심 내용을 대화형으로 탐색할 수 있습니다.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  {isAuthenticated() ? (
                    <Link
                      to="/upload"
                      className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                    >
                      <Upload className="h-5 w-5 mr-2" />
                      PDF 업로드 시작
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleFeatureClick('upload')}
                      className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                    >
                      <Upload className="h-5 w-5 mr-2" />
                      PDF 업로드 시작
                    </button>
                  )}
                  <button 
                    onClick={() => handleFeatureClick('demo')}
                    className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <MessageSquare className="h-5 w-5 mr-2" />
                    {isAuthenticated() ? '데모 보기' : '기능 체험하기'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Features Section */}
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                강력한 논문 분석 기능
              </h2>
              <p className="text-lg text-gray-600">
                ResearchBot이 제공하는 핵심 기능들을 확인해보세요
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="bg-blue-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Upload className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  간편한 PDF 업로드
                </h3>
                <p className="text-gray-600">
                  드래그 앤 드롭으로 PDF 논문을 쉽게 업로드하고 AI가 자동으로 분석합니다.
                </p>
              </div>

              <div className="text-center">
                <div className="bg-green-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Search className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  지능형 질문-답변
                </h3>
                <p className="text-gray-600">
                  논문에 대한 질문을 자연어로 입력하면 AI가 정확한 답변과 출처를 제공합니다.
                </p>
              </div>

              <div className="text-center">
                <div className="bg-purple-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Zap className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  빠른 처리 속도
                </h3>
                <p className="text-gray-600">
                  10페이지 논문을 30초 내에 처리하고 질문에 5초 내에 답변합니다.
                </p>
              </div>
            </div>
          </div>

          {/* Use Cases Section */}
          <div className="bg-white py-16">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  언제 사용하나요?
                </h2>
                <p className="text-lg text-gray-600">
                  ResearchBot이 유용한 다양한 사용 시나리오
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    연구 논문 리뷰
                  </h3>
                  <p className="text-gray-600">
                    새로운 연구 논문을 빠르게 파악하고 핵심 내용을 요약하여 연구 방향을 결정합니다.
                  </p>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    기술 문서 분석
                  </h3>
                  <p className="text-gray-600">
                    복잡한 기술 문서나 백서를 이해하고 구현 방법을 찾아냅니다.
                  </p>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    학습 및 교육
                  </h3>
                  <p className="text-gray-600">
                    학생들이 어려운 논문을 쉽게 이해하고 질문을 통해 깊이 있는 학습을 할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 비회원용 데모 체험 강조 섹션 */}
          {!isAuthenticated() && (
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-8 text-center border-2 border-dashed border-green-300">
                <div className="max-w-3xl mx-auto">
                  <div className="flex justify-center mb-6">
                    <div className="bg-green-100 p-4 rounded-full">
                      <MessageSquare className="h-12 w-12 text-green-600" />
                    </div>
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900 mb-4">
                    🚀 AI 논문 분석을 지금 바로 체험해보세요!
                  </h3>
                  <p className="text-lg text-gray-600 mb-6">
                    로그인 없이도 가상의 연구 논문으로 AI와의 대화를 체험할 수 있습니다.
                    <br />
                    <strong>Transformer 기반 자연어 처리 모델의 성능 향상 연구</strong>에 대해 질문해보세요!
                  </p>
                  <div className="bg-white rounded-lg p-6 mb-6 border border-green-200">
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">💡 체험해볼 수 있는 질문들</h4>
                    <div className="grid md:grid-cols-2 gap-3 text-left">
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        <span className="text-gray-700">이 연구의 주요 목적은 무엇인가요?</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        <span className="text-gray-700">제안된 방법론의 핵심 아이디어는?</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        <span className="text-gray-700">실험 결과는 어떻게 나왔나요?</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        <span className="text-gray-700">기존 방법과 비교했을 때 어떤 장점이 있나요?</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                      onClick={() => handleFeatureClick('demo')}
                      className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors shadow-lg"
                    >
                      <MessageSquare className="h-6 w-6 mr-2" />
                      지금 바로 데모 체험하기
                    </button>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Link
                        to="/register"
                        className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                      >
                        <UserPlus className="h-5 w-5 mr-2" />
                        무료 회원가입
                      </Link>
                      <Link
                        to="/login"
                        className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                      >
                        <LogIn className="h-5 w-5 mr-2" />
                        기존 회원 로그인
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CTA Section */}
          <div className={`py-16 ${isAuthenticated() ? 'bg-blue-600' : 'bg-gradient-to-r from-green-600 to-emerald-600'}`}>
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <h2 className="text-3xl font-bold text-white mb-4">
                {isAuthenticated() ? '지금 바로 시작하세요' : 'AI 논문 분석을 체험해보세요'}
              </h2>
              <p className="text-xl text-white/90 mb-8">
                {isAuthenticated() 
                  ? '첫 번째 PDF 논문을 업로드하고 AI와 대화형으로 분석해보세요'
                  : '로그인 없이도 가상 논문으로 AI 분석을 체험할 수 있습니다'
                }
              </p>
              {isAuthenticated() ? (
                <Link
                  to="/upload"
                  className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-md text-blue-600 bg-white hover:bg-gray-50 transition-colors"
                >
                  <Upload className="h-6 w-6 mr-2" />
                  PDF 업로드 시작
                </Link>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={() => handleFeatureClick('demo')}
                    className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-md text-green-600 bg-white hover:bg-gray-50 transition-colors shadow-lg"
                  >
                    <MessageSquare className="h-6 w-6 mr-2" />
                    데모 체험하기
                  </button>
                  <Link
                    to="/register"
                    className="inline-flex items-center px-6 py-3 border border-white text-base font-medium rounded-md text-white hover:bg-white hover:text-green-600 transition-colors"
                  >
                    <UserPlus className="h-5 w-5 mr-2" />
                    무료 회원가입
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 오른쪽 파일 목록 사이드바 (1/4) - 로그인한 사용자만 표시 */}
        {isAuthenticated() && (
          <div className="w-1/4 bg-white border-l border-gray-200 shadow-lg">
            <div className="sticky top-0 h-screen overflow-y-auto">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-blue-600" />
                  내 문서
                </h2>
                
                <ExistingFilesList onDocumentSelect={handleDocumentSelect} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 로그인 안내 모달 */}
      <LoginPromptModal />
    </div>
  );
};

export default HomePage;
