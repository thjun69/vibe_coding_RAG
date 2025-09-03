import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Upload, MessageSquare, Search, Zap } from 'lucide-react';
import ExistingFilesList from '../components/ExistingFilesList';

const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Hero Section */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
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
              <Link
                to="/upload"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                <Upload className="h-5 w-5 mr-2" />
                PDF 업로드 시작
              </Link>
              <button className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors">
                <MessageSquare className="h-5 w-5 mr-2" />
                데모 보기
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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

      {/* Existing Files Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            기존 PDF 파일
          </h2>
          <p className="text-lg text-gray-600">
            이전에 업로드한 PDF 파일들을 확인하고 계속 분석할 수 있습니다
          </p>
        </div>
        
        <ExistingFilesList />
      </div>

      {/* CTA Section */}
      <div className="bg-blue-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            지금 바로 시작하세요
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            첫 번째 PDF 논문을 업로드하고 AI와 대화형으로 분석해보세요
          </p>
          <Link
            to="/upload"
            className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-md text-blue-600 bg-white hover:bg-gray-50 transition-colors"
          >
            <Upload className="h-6 w-6 mr-2" />
            PDF 업로드 시작
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
