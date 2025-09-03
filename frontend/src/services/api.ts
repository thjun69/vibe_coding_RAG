import axios from 'axios';

const API_BASE_URL = '/api';

// Axios 인스턴스 생성
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// 기존 PDF 파일 목록 조회
export const getExistingDocuments = async () => {
  try {
    const response = await api.get('/documents/existing');
    return response.data;
  } catch (error) {
    console.error('Error fetching existing documents:', error);
    throw error;
  }
};

// 문서 업로드
export const uploadDocument = async (file: File) => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading document:', error);
    throw error;
  }
};

// 문서 처리 상태 조회
export const getDocumentStatus = async (documentId: string) => {
  try {
    const response = await api.get(`/documents/${documentId}/status`);
    return response.data;
  } catch (error) {
    console.error('Error fetching document status:', error);
    throw error;
  }
};

// 채팅 메시지 전송
export const sendChatMessage = async (documentId: string, message: string, sessionId?: string) => {
  try {
    const response = await api.post(`/chat/${documentId}`, {
      message,
      session_id: sessionId,
    });
    return response.data;
  } catch (error) {
    console.error('Error sending chat message:', error);
    throw error;
  }
};

// 채팅 히스토리 조회
export const getChatHistory = async (sessionId: string) => {
  try {
    const response = await api.get(`/chat/${sessionId}/history`);
    return response.data;
  } catch (error) {
    console.error('Error fetching chat history:', error);
    throw error;
  }
};

// 샘플 질문 조회
export const getSampleQuestions = async (documentId: string) => {
  try {
    const response = await api.get(`/chat/${documentId}/sample-questions`);
    return response.data;
  } catch (error) {
    console.error('Error fetching sample questions:', error);
    throw error;
  }
};

// 문서 삭제
export const deleteDocument = async (documentId: string) => {
  try {
    const response = await api.delete(`/documents/${documentId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
};
