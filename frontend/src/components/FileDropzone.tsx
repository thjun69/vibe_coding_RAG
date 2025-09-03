import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle } from 'lucide-react';

interface FileDropzoneProps {
  onFileUpload: (file: File) => void;
  isUploading?: boolean;
}

const FileDropzone: React.FC<FileDropzoneProps> = ({ onFileUpload, isUploading = false }) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileUpload(acceptedFiles[0]);
    }
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    disabled: isUploading
  });

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
          ${isDragActive && !isDragReject 
            ? 'border-primary-500 bg-primary-50' 
            : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
          }
          ${isDragReject ? 'border-red-500 bg-red-50' : ''}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center space-y-4">
          {isDragReject ? (
            <AlertCircle className="w-12 h-12 text-red-500" />
          ) : (
            <Upload className="w-12 h-12 text-primary-500" />
          )}
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {isDragReject 
                ? 'PDF 파일만 업로드 가능합니다' 
                : isDragActive 
                  ? '파일을 여기에 놓으세요' 
                  : 'PDF 논문을 업로드하세요'
              }
            </h3>
            
            <p className="text-sm text-gray-600">
              {isDragReject 
                ? 'PDF 형식의 파일만 지원됩니다.' 
                : '드래그 앤 드롭으로 파일을 업로드하거나 클릭하여 선택하세요'
              }
            </p>
          </div>
          
          {!isDragActive && !isDragReject && (
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <FileText className="w-4 h-4" />
              <span>PDF 파일 (최대 50MB)</span>
            </div>
          )}
          
          {isUploading && (
            <div className="mt-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
              <p className="text-sm text-gray-600 mt-2">업로드 중...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileDropzone;
