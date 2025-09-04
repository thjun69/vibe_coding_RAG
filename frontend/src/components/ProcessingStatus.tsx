import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Clock, FileText, Terminal } from 'lucide-react';
import { ProcessingStatusResponse } from '../types';
import { getDocumentLogs } from '../services/api';

interface ProcessingStatusProps {
  status: ProcessingStatusResponse | null;
  isLoading?: boolean;
  documentId?: string;
}

const ProcessingStatus: React.FC<ProcessingStatusProps> = ({ status, isLoading = false, documentId }) => {
  const [serverLogs, setServerLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  // 실제 서버 로그 가져오기
  useEffect(() => {
    if (documentId) {
      const fetchLogs = async () => {
        try {
          const response = await getDocumentLogs(documentId);
          setServerLogs(response.logs);
        } catch (error) {
          console.error('Error fetching document logs:', error);
          // 로그 가져오기 실패 시 기본 로그 표시
          setServerLogs([
            `[${new Date().toLocaleTimeString()}] 문서 업로드 완료: ${documentId}`,
            `[${new Date().toLocaleTimeString()}] 처리 진행 중...`
          ]);
        }
      };
      
      // 초기 로그 로드
      fetchLogs();
      
      // 처리 중일 때는 주기적으로 로그 업데이트
      if (status?.status === 'processing') {
        const logInterval = setInterval(fetchLogs, 3000); // 3초마다 업데이트
        return () => clearInterval(logInterval);
      }
    }
  }, [documentId, status?.status]);
  if (isLoading) {
    return (
      <div className="card animate-pulse">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
          <div className="h-4 bg-gray-200 rounded w-32"></div>
        </div>
      </div>
    );
  }

  if (!status) return null;

  const getStatusIcon = () => {
    switch (status.status) {
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-6 h-6 text-red-500" />;
      case 'processing':
      default:
        return <Clock className="w-6 h-6 text-blue-500 animate-spin" />;
    }
  };

  const getStatusText = () => {
    switch (status.status) {
      case 'completed':
        return '처리 완료';
      case 'error':
        return '처리 오류';
      case 'processing':
      default:
        return '처리 중...';
    }
  };

  const getStatusColor = () => {
    switch (status.status) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'processing':
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className={`card border-2 ${getStatusColor()}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div>
            <h3 className="font-semibold">{getStatusText()}</h3>
            {status.status === 'completed' && (
              <div className="flex items-center space-x-4 text-sm mt-1">
                <span className="flex items-center space-x-1">
                  <FileText className="w-4 h-4" />
                  <span>{status.total_pages}페이지</span>
                </span>
                <span className="flex items-center space-x-1">
                  <FileText className="w-4 h-4" />
                  <span>{status.total_chunks}개 청크</span>
                </span>
              </div>
            )}
          </div>
        </div>
        
        {status.status === 'error' && status.error_message && (
          <div className="text-sm text-red-600 max-w-xs">
            {status.error_message}
          </div>
        )}
      </div>
      
      {status.status === 'processing' && (
        <div className="mt-4 space-y-4">
          {/* 진행률 바 */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
          </div>
          <p className="text-sm text-gray-600">문서를 분석하고 있습니다...</p>
          
          {/* 서버 로그 표시 */}
          <div className="mt-4">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Terminal className="w-4 h-4" />
              <span>{showLogs ? '로그 숨기기' : '서버 로그 보기'}</span>
            </button>
            
            {showLogs && (
              <div className="mt-3 bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-xs max-h-40 overflow-y-auto">
                {serverLogs.length === 0 ? (
                  <div className="text-gray-500">로그를 수집하는 중...</div>
                ) : (
                  serverLogs.map((log, index) => (
                    <div key={index} className="mb-1">
                      {log}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessingStatus;
