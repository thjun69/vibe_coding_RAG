import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getExistingDocuments } from '../services/api';
import { FileText, Calendar, HardDrive, Play } from 'lucide-react';

interface ExistingFile {
  filename: string;
  size_bytes: number;
  size_mb: number;
  modified_time: string;
  file_path: string;
}

interface ExistingFilesResponse {
  existing_files: ExistingFile[];
  total_count: number;
}

const ExistingFilesList: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery<ExistingFilesResponse>({
    queryKey: ['existingDocuments'],
    queryFn: getExistingDocuments,
    refetchInterval: 5000, // 5초마다 새로고침
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleFileSelect = (file: ExistingFile) => {
    // 파일 선택 시 채팅 페이지로 이동
    // Mock 모드에서는 임시 document_id 생성
    const mockDocumentId = `existing_${Date.now()}`;
    console.log('Selected file:', file.filename, 'Document ID:', mockDocumentId);
    
    // 채팅 페이지로 이동
    navigate(`/chat/${mockDocumentId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">기존 파일 목록을 불러오는 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">파일 목록을 불러오는 중 오류가 발생했습니다.</p>
        <button
          onClick={() => refetch()}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!data || data.total_count === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">기존 PDF 파일이 없습니다</h3>
        <p className="text-gray-600">새로운 PDF 파일을 업로드하여 시작하세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          기존 PDF 파일 ({data.total_count}개)
        </h3>
        <button
          onClick={() => refetch()}
          className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
        >
          새로고침
        </button>
      </div>
      
      <div className="grid gap-3">
        {data.existing_files.map((file, index) => (
          <div
            key={index}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
            onClick={() => handleFileSelect(file)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {file.filename}
                    </h4>
                    <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                      <div className="flex items-center space-x-1">
                        <HardDrive className="h-3 w-3" />
                        <span>{file.size_mb} MB</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(file.modified_time)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 ml-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFileSelect(file);
                  }}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors"
                >
                  <Play className="h-3 w-3 mr-1" />
                  선택
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="text-xs text-gray-500 text-center">
        파일을 클릭하거나 선택 버튼을 눌러 해당 문서로 분석을 시작할 수 있습니다.
      </div>
    </div>
  );
};

export default ExistingFilesList;
