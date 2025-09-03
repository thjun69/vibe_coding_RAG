import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import FileDropzone from '../components/FileDropzone';
import ProcessingStatus from '../components/ProcessingStatus';
import { uploadDocument, getDocumentStatus } from '../services/api';
import { UploadResponse, ProcessingStatusResponse } from '../types';

const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const [uploadedDocument, setUploadedDocument] = useState<UploadResponse | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatusResponse | null>(null);

  // 문서 업로드 뮤테이션
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

  // 상태 폴링
  const startStatusPolling = (documentId: string) => {
    const pollStatus = async () => {
      try {
        const status = await getDocumentStatus(documentId);
        setProcessingStatus(status);
        
        if (status.status === 'completed') {
          // 처리 완료 시 채팅 페이지로 이동
          setTimeout(() => {
            navigate(`/chat/${documentId}`);
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

  const handleFileUpload = (file: File) => {
    uploadMutation.mutate(file);
  };

  const handleNewUpload = () => {
    setUploadedDocument(null);
    setProcessingStatus(null);
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
        {!uploadedDocument ? (
          <div className="space-y-6">
            <FileDropzone 
              onFileUpload={handleFileUpload}
              isUploading={uploadMutation.isPending}
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
                
                <ProcessingStatus status={processingStatus} />
              </div>
            </div>
            
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
