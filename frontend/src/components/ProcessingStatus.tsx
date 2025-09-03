import React from 'react';
import { CheckCircle, AlertCircle, Clock, FileText } from 'lucide-react';
import { ProcessingStatusResponse } from '../types';

interface ProcessingStatusProps {
  status: ProcessingStatusResponse | null;
  isLoading?: boolean;
}

const ProcessingStatus: React.FC<ProcessingStatusProps> = ({ status, isLoading = false }) => {
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
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
          </div>
          <p className="text-sm text-gray-600 mt-2">문서를 분석하고 있습니다...</p>
        </div>
      )}
    </div>
  );
};

export default ProcessingStatus;
