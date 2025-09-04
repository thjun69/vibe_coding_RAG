import axios from 'axios';
import { UserCreate, UserLogin, UserLoginResponse, User } from '../types';

const API_BASE_URL = '/api';

// Axios 인스턴스 생성
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// 토큰 관리
const TOKEN_KEY = 'auth_token';

export const getToken = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  console.log('🔑 getToken called:', { hasToken: !!token, tokenLength: token ? token.length : 0 });
  return token;
};
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const removeToken = () => localStorage.removeItem(TOKEN_KEY);

// 요청 인터셉터: 토큰을 자동으로 헤더에 추가
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 응답 인터셉터: 401 에러 시 토큰 제거 (페이지 리다이렉트는 하지 않음)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      removeToken();
      // 토큰만 제거하고 자동 리다이렉트는 하지 않음
      // 각 컴포넌트에서 필요에 따라 처리
    }
    return Promise.reject(error);
  }
);

// 기존 PDF 파일 목록 조회 (비회원용)
export const getExistingDocuments = async () => {
  try {
    const response = await api.get('/documents/existing');
    return response.data;
  } catch (error) {
    console.error('Error fetching existing documents:', error);
    throw error;
  }
};

// 내 문서 목록 조회 (로그인 사용자용)
export const getMyDocuments = async () => {
  try {
    const response = await api.get('/documents/my-documents');
    return response.data;
  } catch (error) {
    console.error('Error fetching my documents:', error);
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

// 멀티 문서 업로드
export const uploadMultipleDocuments = async (files: File[]) => {
  try {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await api.post('/documents/upload-multiple', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading multiple documents:', error);
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

// 문서 처리 로그 조회
export const getDocumentLogs = async (documentId: string): Promise<{ logs: string[] }> => {
  try {
    const response = await api.get(`/documents/${documentId}/logs`);
    return response.data;
  } catch (error) {
    console.error('Error fetching document logs:', error);
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

// 멀티 문서 채팅 메시지 전송
export const sendMultiChatMessage = async (documentIds: string[], message: string, sessionId?: string) => {
  try {
    const response = await api.post('/chat/multi', {
      document_ids: documentIds,
      message,
      session_id: sessionId,
    });
    return response.data;
  } catch (error) {
    console.error('Error sending multi-chat message:', error);
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

// 문서 상태 새로고침
export const refreshDocumentStatus = async () => {
  try {
    const response = await api.post('/documents/refresh-status');
    return response.data;
  } catch (error) {
    console.error('Error refreshing document status:', error);
    throw error;
  }
};

// ==================== 인증 관련 API ====================

// 회원가입
export const registerUser = async (userData: UserCreate): Promise<User> => {
  try {
    const response = await api.post('/auth/register', userData);
    return response.data;
  } catch (error) {
    console.error('Error registering user:', error);
    throw error;
  }
};

// 로그인
export const loginUser = async (loginData: UserLogin): Promise<UserLoginResponse> => {
  try {
    const response = await api.post('/auth/login', loginData);
    const { access_token } = response.data;
    
    // 토큰 저장
    setToken(access_token);
    
    return response.data;
  } catch (error) {
    console.error('Error logging in:', error);
    throw error;
  }
};

// 로그아웃
export const logoutUser = async (): Promise<void> => {
  try {
    await api.post('/auth/logout');
  } catch (error) {
    console.error('Error logging out:', error);
  } finally {
    // 토큰 제거 (API 호출 실패해도 로컬 토큰은 제거)
    removeToken();
  }
};

// 현재 사용자 정보 조회
export const getCurrentUser = async (): Promise<User> => {
  try {
    const response = await api.get('/auth/me');
    return response.data;
  } catch (error) {
    console.error('Error getting current user:', error);
    throw error;
  }
};

// 로그인 상태 확인
export const isAuthenticated = (): boolean => {
  const token = getToken();
  const isAuth = !!token;
  console.log('🔐 isAuthenticated check:', { hasToken: !!token, isAuth });
  return isAuth;
};
