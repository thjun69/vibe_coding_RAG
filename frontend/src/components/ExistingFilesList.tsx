import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getExistingDocuments, getMyDocuments, isAuthenticated, refreshDocumentStatus } from '../services/api';
import { FileText, Play, RefreshCw } from 'lucide-react';

interface ExistingFile {
  filename: string;
  size_bytes: number;
  size_mb: number;
  modified_time: string;
  file_path: string;
}

interface UserDocument {
  document_id: string;
  filename: string;
  upload_timestamp: string;
  processing_status: string;
  total_pages: number;
  total_chunks: number;
  size_mb: number;
}

interface ExistingFilesResponse {
  existing_files: ExistingFile[];
  total_count: number;
}

interface UserDocumentsResponse {
  user_documents: UserDocument[];
  total_count: number;
}

interface ExistingFilesListProps {
  onDocumentSelect?: (documentId: string) => void;
}

const ExistingFilesList: React.FC<ExistingFilesListProps> = ({ onDocumentSelect }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const authenticated = isAuthenticated();
  
  // 선택된 문서들 관리
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  
  // 문서 상태 새로고침 뮤테이션
  const refreshStatusMutation = useMutation({
    mutationFn: refreshDocumentStatus,
    onSuccess: () => {
      // 문서 목록 쿼리 무효화하여 새로고침
      queryClient.invalidateQueries({ queryKey: ['myDocuments'] });
      console.log('✅ 문서 상태 새로고침 완료');
    },
    onError: (error) => {
      console.error('❌ 문서 상태 새로고침 실패:', error);
      alert('문서 상태 새로고침에 실패했습니다.');
    },
  });
  
  // 로그인한 사용자는 내 문서, 비회원은 기존 파일 목록
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: authenticated ? ['myDocuments'] : ['existingDocuments'],
    queryFn: authenticated ? getMyDocuments : getExistingDocuments,
    refetchInterval: (selectedDocuments.size > 0 || selectedFiles.size > 0) ? false : 5000, // 선택된 항목이 있으면 새로고침 중지
  });

  // 데모용 샘플 문서 데이터
  const demoDocuments = [
    {
      document_id: 'demo_sample_paper',
      filename: '📚 AI 논문 분석 데모',
      upload_timestamp: new Date().toISOString(),
      processing_status: 'completed',
      total_pages: 15,
      total_chunks: 25,
      size_mb: 2.5,
      isDemo: true
    }
  ];

  // 문서 삭제 후 목록 새로고침을 위한 함수
  const refreshDocuments = () => {
    console.log('🔄 문서 목록 새로고침 요청');
    refetch();
  };

  // 문서 삭제 이벤트 감지 및 자동 새로고침
  useEffect(() => {
    const handleDocumentDeleted = (event: CustomEvent) => {
      const { documentId } = event.detail;
      console.log('🗑️ 문서 삭제 이벤트 감지:', documentId);
      
      // 선택된 문서에서 삭제된 문서 제거
      if (selectedDocuments.has(documentId)) {
        const newSelected = new Set(selectedDocuments);
        newSelected.delete(documentId);
        setSelectedDocuments(newSelected);
        console.log('✅ 삭제된 문서를 선택 목록에서 제거:', documentId);
      }
      
      // 문서 목록 새로고침
      setTimeout(() => {
        console.log('🔄 삭제 이벤트로 인한 자동 새로고침');
        refreshDocuments();
      }, 500); // 백엔드 처리 시간 고려
    };

    // localStorage에서 최근 삭제 이벤트 확인
    const lastDelete = localStorage.getItem('lastDocumentDelete');
    if (lastDelete) {
      try {
        const { documentId, timestamp } = JSON.parse(lastDelete);
        const timeDiff = Date.now() - timestamp;
        
        // 5초 이내의 삭제 이벤트라면 자동 새로고침
        if (timeDiff < 5000) {
          console.log('🔄 localStorage에서 최근 삭제 이벤트 감지, 자동 새로고침');
          refreshDocuments();
        }
        
        // localStorage 정리
        localStorage.removeItem('lastDocumentDelete');
      } catch (error) {
        console.error('❌ localStorage 삭제 이벤트 파싱 오류:', error);
      }
    }

    // 이벤트 리스너 등록
    window.addEventListener('documentDeleted', handleDocumentDeleted as EventListener);
    
    return () => {
      window.removeEventListener('documentDeleted', handleDocumentDeleted as EventListener);
    };
  }, [selectedDocuments, refetch]);

  // 날짜 포맷팅 함수
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dateString;
    }
  };

  // 문서 선택/해제 핸들러
  const handleDocumentToggle = (documentId: string) => {
    const newSelected = new Set(selectedDocuments);
    if (newSelected.has(documentId)) {
      newSelected.delete(documentId);
    } else {
      newSelected.add(documentId);
    }
    setSelectedDocuments(newSelected);
    console.log('📝 문서 선택 상태 변경:', documentId, newSelected.has(documentId));
  };

  // 파일 선택/해제 핸들러
  const handleFileToggle = (index: number) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedFiles(newSelected);
    console.log('📁 파일 선택 상태 변경:', index, newSelected.has(index));
  };

  // 선택된 문서들로 분석하기
  const handleAnalyzeSelected = () => {
    console.log('🔍 분석하기 버튼 클릭됨');
    console.log('🔍 selectedDocuments:', Array.from(selectedDocuments));
    console.log('🔍 selectedFiles:', Array.from(selectedFiles));
    
    if (authenticated && selectedDocuments.size > 0) {
      const documentIds = Array.from(selectedDocuments);
      console.log('🔍 로그인 사용자 - 선택된 문서들:', documentIds);
      
      if (documentIds.length === 1) {
        // 단일 문서 선택
        const documentId = documentIds[0];
        console.log('🔍 단일 문서 분석:', documentId);
        
        if (onDocumentSelect) {
          console.log('📞 onDocumentSelect 콜백 호출:', documentId);
          onDocumentSelect(documentId);
        } else {
          console.log('🔗 직접 네비게이션:', `/chat?document=${documentId}`);
          navigate(`/chat?document=${documentId}`);
        }
      } else {
        // 다중 문서 선택
        console.log('🔍 다중 문서 분석:', documentIds);
        const queryParams = documentIds.map(id => `documents=${id}`).join('&');
        console.log('🔍 쿼리 파라미터:', queryParams);
        
        if (onDocumentSelect) {
          console.log('📞 onDocumentSelect 콜백 호출 (다중):', documentIds.join(','));
          onDocumentSelect(documentIds.join(',')); // 모든 문서 ID를 콤마로 구분해서 콜백
        } else {
          console.log('🔗 직접 네비게이션 (다중):', `/chat?${queryParams}`);
          try {
            navigate(`/chat?${queryParams}`);
            console.log('✅ 직접 네비게이션 성공');
          } catch (error) {
            console.error('❌ 직접 네비게이션 실패:', error);
          }
        }
      }
    } else if (!authenticated && selectedFiles.size > 0) {
      const fileIndices = Array.from(selectedFiles);
      const mockDocumentId = `existing_multi_${Date.now()}`;
      console.log('🔄 Processing unauthenticated files:', fileIndices);
      
      if (onDocumentSelect) {
        console.log('📞 Calling onDocumentSelect with mock ID:', mockDocumentId);
        onDocumentSelect(mockDocumentId);
      } else {
        console.log('🔗 Navigating to mock chat:', `/chat/${mockDocumentId}`);
        navigate(`/chat/${mockDocumentId}`, { 
          state: { 
            selectedFileIndices: fileIndices,
            files: (data as ExistingFilesResponse)?.existing_files 
          } 
        });
      }
    } else {
      console.log('❌ No documents or files selected');
    }
  };

  const handleFileSelect = (file: ExistingFile) => {
    // 기존 파일 선택 시
    const mockDocumentId = `existing_${Date.now()}`;
    
    if (onDocumentSelect) {
      // 홈페이지에서 호출된 경우 콜백 실행
      onDocumentSelect(mockDocumentId);
    } else {
      // 직접 페이지에서 호출된 경우 네비게이션
      navigate(`/chat/${mockDocumentId}`, { state: { file } });
    }
  };

  const handleDocumentSelect = (document: UserDocument) => {
    if (onDocumentSelect) {
      // 홈페이지에서 호출된 경우 콜백 실행
      onDocumentSelect(document.document_id);
    } else {
      // 직접 페이지에서 호출된 경우 네비게이션
      navigate(`/chat/${document.document_id}`);
    }
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
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {authenticated ? '업로드한 문서가 없습니다' : '기존 PDF 파일이 없습니다'}
        </h3>
        <p className="text-gray-600">
          {authenticated ? '새로운 PDF 파일을 업로드하여 시작하세요.' : '관리자가 업로드한 샘플 PDF 파일이 없습니다.'}
        </p>
      </div>
    );
  }

  // 로그인한 사용자의 문서 목록
  if (authenticated && 'user_documents' in data) {
    const userDocuments = (data as UserDocumentsResponse).user_documents;
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            내 문서 ({data.total_count}개)
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => refreshStatusMutation.mutate()}
              disabled={refreshStatusMutation.isPending}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
              title="문서 상태 새로고침"
            >
              <RefreshCw className={`w-4 h-4 ${refreshStatusMutation.isPending ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => refetch()}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
            >
              새로고침
            </button>
          </div>
        </div>
        
        {/* 선택 상태 및 분석 버튼 */}
        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-md">
          <span className="text-sm text-gray-600">
            {selectedDocuments.size}개 선택됨
          </span>
          <button
            onClick={(e) => {
              console.log('🖱️ 분석하기 버튼 클릭됨!');
              console.log('🖱️ selectedDocuments.size:', selectedDocuments.size);
              console.log('🖱️ 버튼 disabled 상태:', selectedDocuments.size === 0);
              e.preventDefault();
              e.stopPropagation();
              handleAnalyzeSelected();
            }}
            disabled={selectedDocuments.size === 0}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="h-4 w-4 mr-1" />
            분석하기
          </button>
        </div>
        
        <div className="space-y-2">
          {userDocuments.map((document) => (
            <div
              key={document.document_id}
              className={`border rounded-md p-3 transition-all ${
                selectedDocuments.has(document.document_id)
                  ? 'bg-blue-50 border-blue-300'
                  : 'bg-gray-50 border-gray-200 hover:bg-blue-50 hover:border-blue-300'
              }`}
            >
              <div className="flex items-start space-x-3">
                {/* 체크박스 */}
                <input
                  type="checkbox"
                  checked={selectedDocuments.has(document.document_id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleDocumentToggle(document.document_id);
                  }}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                
                {/* 파일 아이콘 */}
                <FileText className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                
                {/* 파일 정보 */}
                <div 
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => handleDocumentSelect(document)}
                >
                  <h4 className="text-sm font-medium text-gray-900 truncate mb-1">
                    {document.filename}
                  </h4>
                  <div className="flex items-center text-xs text-gray-500 space-x-2">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                      document.processing_status === 'completed' 
                        ? 'bg-green-100 text-green-700' 
                        : document.processing_status === 'processing'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {document.processing_status === 'completed' ? '완료' : 
                       document.processing_status === 'processing' ? '처리중' : '오류'}
                    </span>
                    <span>{document.size_mb} MB</span>
                    {document.total_pages > 0 && (
                      <span>{document.total_pages}p</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {formatDate(document.upload_timestamp)}
                  </div>
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
  }

  // 비회원용 기존 파일 목록 + 데모 문서
  const existingFiles = (data as ExistingFilesResponse).existing_files;
  
  return (
    <div className="space-y-4">
      {/* 데모 문서 섹션 */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
          🚀 데모 체험
        </h3>
        <div className="space-y-2">
          {demoDocuments.map((document) => (
            <div
              key={document.document_id}
              className="border-2 border-dashed border-blue-300 rounded-md p-3 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-all cursor-pointer"
              onClick={() => handleDocumentSelect(document)}
            >
              <div className="flex items-start space-x-3">
                <div className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5">
                  🎯
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 truncate mb-1">
                    {document.filename}
                  </h4>
                  <div className="flex items-center text-xs text-gray-500 space-x-2">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-medium">
                      데모
                    </span>
                    <span>{document.size_mb} MB</span>
                    <span>{document.total_pages}p</span>
                  </div>
                  <div className="text-xs text-blue-600 mt-1 font-medium">
                    클릭하여 데모 시작 →
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          샘플 PDF 파일 ({data.total_count}개)
        </h3>
        <button
          onClick={() => refetch()}
          className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
        >
          새로고침
        </button>
      </div>
      
      {/* 선택 상태 및 분석 버튼 */}
      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-md">
        <span className="text-sm text-gray-600">
          {selectedFiles.size}개 선택됨
        </span>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleAnalyzeSelected();
          }}
          disabled={selectedFiles.size === 0}
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          <Play className="h-4 w-4 mr-1" />
          분석하기
        </button>
      </div>
      
      <div className="space-y-2">
        {existingFiles.map((file, index) => (
          <div
            key={index}
            className={`border rounded-md p-3 transition-all ${
              selectedFiles.has(index)
                ? 'bg-blue-50 border-blue-300'
                : 'bg-gray-50 border-gray-200 hover:bg-blue-50 hover:border-blue-300'
            }`}
          >
            <div className="flex items-start space-x-3">
              {/* 체크박스 */}
              <input
                type="checkbox"
                checked={selectedFiles.has(index)}
                onChange={(e) => {
                  e.stopPropagation();
                  handleFileToggle(index);
                }}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              
              {/* 파일 아이콘 */}
              <FileText className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              
              {/* 파일 정보 */}
              <div 
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => handleFileSelect(file)}
              >
                <h4 className="text-sm font-medium text-gray-900 truncate mb-1">
                  {file.filename}
                </h4>
                <div className="flex items-center text-xs text-gray-500 space-x-2">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-medium">
                    샘플
                  </span>
                  <span>{file.size_mb} MB</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {formatDate(file.modified_time)}
                </div>
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