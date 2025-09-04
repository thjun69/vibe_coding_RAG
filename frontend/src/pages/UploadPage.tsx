import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Upload, FileText, CheckCircle, AlertCircle, Settings } from 'lucide-react';
import FileDropzone from '../components/FileDropzone';
import ProcessingStatus from '../components/ProcessingStatus';
import { uploadDocument, uploadMultipleDocuments, getDocumentStatus } from '../services/api';
import { UploadResponse, ProcessingStatusResponse, MultipleUploadResponse } from '../types';

const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const [uploadedDocument, setUploadedDocument] = useState<UploadResponse | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatusResponse | null>(null);
  const [uploadMode, setUploadMode] = useState<'single' | 'multiple'>('single');
  const [uploadedDocuments, setUploadedDocuments] = useState<MultipleUploadResponse | null>(null);

  // 단일 문서 업로드 뮤테이션
  const uploadMutation = useMutation({
    mutationFn: uploadDocument,
    onSuccess: (data: UploadResponse) => {
      setUploadedDocument(data);
      // 처리 상태 폴링 시작
      startStatusPolling(data.document_id);
    },
    onError: (error: any) => {
      console.error('Upload error:', error);
      alert('문서 업로드 중 오류가 발생했습니다.');
    },
  });

  // 멀티 문서 업로드 뮤테이션
  const uploadMultipleMutation = useMutation({
    mutationFn: uploadMultipleDocuments,
    onSuccess: (data: MultipleUploadResponse) => {
      setUploadedDocuments(data);
      // 첫 번째 문서의 처리 상태 폴링 시작
      if (data.uploaded_documents.length > 0) {
        startStatusPolling(data.uploaded_documents[0].document_id);
      }
    },
    onError: (error: any) => {
      console.error('Multiple upload error:', error);
      alert('문서 업로드 중 오류가 발생했습니다.');
    },
  });

  // 상태 폴링
  const startStatusPolling = (documentId: string) => {
    const pollStatus = async () => {
      try {
        const status = await getDocumentStatus(documentId);
        setProcessingStatus(status);
        
        if (status.status === 'completed') {
          // 처리 완료 시 채팅 페이지로 이동 (쿼리 파라미터 사용)
          setTimeout(() => {
            navigate(`/chat?document=${documentId}`);
          }, 2000);
        } else if (status.status === 'error') {
          // 에러 발생 시 폴링 중단
          return;
        } else {
          // 계속 폴링
          setTimeout(pollStatus, 2000);
        }
      } catch (error) {
        console.error('Status polling error:', error);
      }
    };
    
    pollStatus();
  };

  const handleFileUpload = (files: File[]) => {
    // 중복 파일 검사
    const duplicateFiles = checkDuplicateFiles(files);
    if (duplicateFiles.length > 0) {
      const duplicateNames = duplicateFiles.map(f => f.filename).join(', ');
      alert(`다음 파일들은 이미 업로드되어 있습니다:\n${duplicateNames}\n\n중복 파일은 자동으로 제외됩니다.`);
      
      // 중복 파일 제외하고 업로드
      const uniqueFiles = files.filter(file => 
        !duplicateFiles.some(dup => dup.filename === file.name)
      );
      
      if (uniqueFiles.length === 0) {
        alert('업로드할 고유한 파일이 없습니다.');
        return;
      }
      
      if (uploadMode === 'single') {
        uploadMutation.mutate(uniqueFiles[0]);
      } else {
        uploadMultipleMutation.mutate(uniqueFiles);
      }
    } else {
      if (uploadMode === 'single') {
        uploadMutation.mutate(files[0]);
      } else {
        uploadMultipleMutation.mutate(files);
      }
    }
  };

  // 중복 파일 검사 함수
  const checkDuplicateFiles = (files: File[]) => {
    const duplicateFiles: Array<{filename: string, reason: string}> = [];
    
    // 현재 사용자의 문서 목록에서 중복 검사
    if (uploadedDocument || uploadedDocuments) {
      const existingFiles = uploadedDocument 
        ? [{filename: uploadedDocument.filename}]
        : uploadedDocuments?.uploaded_documents.map(doc => ({filename: doc.filename})) || [];
      
      for (const file of files) {
        const isDuplicate = existingFiles.some(existing => 
          existing.filename === file.name
        );
        
        if (isDuplicate) {
          duplicateFiles.push({
            filename: file.name,
            reason: '이미 업로드된 파일'
          });
        }
      }
    }
    
    return duplicateFiles;
  };

  // 파일 업로드 전 중복 검사 (서버에서 확인)
  const handleFileUploadWithCheck = async (files: File[]) => {
    try {
      // 클라이언트 측 중복 검사
      const duplicateFiles = checkDuplicateFiles(files);
      if (duplicateFiles.length > 0) {
        const duplicateNames = duplicateFiles.map(f => f.filename).join(', ');
        const shouldContinue = confirm(
          `다음 파일들은 이미 업로드되어 있습니다:\n${duplicateNames}\n\n계속 진행하시겠습니까? 중복 파일은 서버에서 자동으로 제외됩니다.`
        );
        
        if (!shouldContinue) {
          return;
        }
      }
      
      // 파일 업로드 실행
      if (uploadMode === 'single') {
        uploadMutation.mutate(files[0]);
      } else {
        uploadMultipleMutation.mutate(files);
      }
    } catch (error) {
      console.error('Error during file upload check:', error);
      alert('파일 업로드 중 오류가 발생했습니다.');
    }
  };

  const handleNewUpload = () => {
    setUploadedDocument(null);
    setProcessingStatus(null);
    setUploadedDocuments(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 페이지 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            논문 업로드
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            PDF 논문을 업로드하면 AI가 자동으로 분석하여 질문-답변을 도와드립니다.
            최대 50MB까지 업로드 가능하며, 처리에는 약 30초가 소요됩니다.
          </p>
        </div>

        {/* 업로드 영역 */}
        {!uploadedDocument && !uploadedDocuments ? (
          <div className="space-y-6">
            {/* 업로드 모드 선택 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Settings className="w-5 h-5 mr-2" />
                업로드 모드 선택
              </h3>
              <div className="flex space-x-4">
                <button
                  onClick={() => setUploadMode('single')}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    uploadMode === 'single'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  단일 파일 업로드
                </button>
                <button
                  onClick={() => setUploadMode('multiple')}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    uploadMode === 'multiple'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  다중 파일 업로드 (최대 10개)
                </button>
              </div>
            </div>

            <FileDropzone 
              onFileUpload={handleFileUploadWithCheck}
              isUploading={uploadMutation.isPending || uploadMultipleMutation.isPending}
              multiple={uploadMode === 'multiple'}
            />
            
            {/* 업로드 가이드 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                업로드 가이드
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Upload className="w-6 h-6 text-blue-600" />
                  </div>
                  <h4 className="font-medium text-gray-900 mb-2">1. 파일 업로드</h4>
                  <p className="text-sm text-gray-600">
                    PDF 논문을 드래그 앤 드롭하거나 클릭하여 선택하세요
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-6 h-6 text-yellow-600" />
                  </div>
                  <h4 className="font-medium text-gray-900 mb-2">2. 자동 분석</h4>
                  <p className="text-sm text-gray-600">
                    AI가 논문을 분석하고 벡터 데이터베이스에 저장합니다
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <h4 className="font-medium text-gray-900 mb-2">3. 질문 시작</h4>
                  <p className="text-sm text-gray-600">
                    분석 완료 후 논문에 대해 자유롭게 질문하세요
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* 처리 상태 표시 */
          <div className="space-y-6">
            {/* 단일 파일 업로드 완료 */}
            {uploadedDocument && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    업로드 완료
                  </h3>
                  <button
                    onClick={handleNewUpload}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  >
                    새로 업로드
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <FileText className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="font-medium text-gray-900">{uploadedDocument.filename}</p>
                      <p className="text-sm text-gray-500">문서 ID: {uploadedDocument.document_id}</p>
                    </div>
                  </div>
                  
                  <ProcessingStatus 
                    status={processingStatus} 
                    documentId={uploadedDocument.document_id}
                  />
                </div>
              </div>
            )}

            {/* 멀티 파일 업로드 완료 */}
            {uploadedDocuments && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    다중 파일 업로드 완료
                  </h3>
                  <button
                    onClick={handleNewUpload}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  >
                    새로 업로드
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-800 font-medium">
                      {uploadedDocuments.message}
                    </p>
                    {uploadedDocuments.skipped_count > 0 && (
                      <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-yellow-800 text-sm">
                          <strong>중복 파일 제외:</strong> {uploadedDocuments.skipped_count}개 파일이 중복으로 인해 제외되었습니다.
                        </p>
                        <p className="text-yellow-700 text-xs mt-1">
                          총 {uploadedDocuments.total_processed}개 파일 중 {uploadedDocuments.total_count}개 파일이 성공적으로 업로드되었습니다.
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">업로드된 파일 목록:</h4>
                    {uploadedDocuments.uploaded_documents.map((doc, index) => (
                      <div key={doc.document_id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <FileText className="w-5 h-5 text-gray-500" />
                        <div>
                          <p className="font-medium text-gray-900">{doc.filename}</p>
                          <p className="text-sm text-gray-500">문서 ID: {doc.document_id}</p>
                          <p className="text-sm text-gray-500">상태: {doc.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* 첫 번째 문서의 처리 상태 표시 */}
                  {uploadedDocuments.uploaded_documents.length > 0 && (
                    <div className="mt-6">
                      <h4 className="font-medium text-gray-900 mb-3">
                        첫 번째 문서 처리 상태:
                      </h4>
                      <ProcessingStatus 
                        status={processingStatus} 
                        documentId={uploadedDocuments.uploaded_documents[0].document_id}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 처리 완료 시 안내 */}
            {processingStatus?.status === 'completed' && (
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <div>
                    <h4 className="font-semibold text-green-800">
                      분석이 완료되었습니다!
                    </h4>
                    <p className="text-green-700">
                      잠시 후 채팅 페이지로 이동합니다. 논문에 대해 질문을 시작할 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* 에러 발생 시 안내 */}
            {processingStatus?.status === 'error' && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                  <div>
                    <h4 className="font-semibold text-red-800">
                      처리 중 오류가 발생했습니다
                    </h4>
                    <p className="text-red-700">
                      {processingStatus.error_message || '알 수 없는 오류가 발생했습니다.'}
                    </p>
                    <button
                      onClick={handleNewUpload}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors mt-3"
                    >
                      다시 시도
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadPage;
