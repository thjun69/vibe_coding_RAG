export interface Document {
  document_id: string;
  filename: string;
  upload_timestamp: string;
  total_pages: number;
  processing_status: 'processing' | 'completed' | 'error';
  total_chunks: number;
  error_message?: string;
}

export interface UploadResponse {
  document_id: string;
  filename: string;
  status: 'processing' | 'completed' | 'error';
  estimated_processing_time: string;
}

export interface MultipleUploadResponse {
  message: string;
  uploaded_documents: Array<{
    document_id: string;
    filename: string;
    status: string;
  }>;
  total_count: number;
  skipped_count: number;
  total_processed: number;
}

export interface ProcessingStatusResponse {
  document_id: string;
  status: 'processing' | 'completed' | 'error';
  total_pages: number;
  total_chunks: number;
  error_message?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: Source[];
}

export interface Source {
  page_number: number;
  section: string;
  content_snippet: string;
  relevance_score: number;
}

export interface ChatRequest {
  message: string;
  session_id?: string;
}

export interface ChatResponse {
  session_id: string;
  response: string;
  sources: Source[];
  processing_time: string;
}

export interface ChatHistoryResponse {
  session_id: string;
  messages: ChatMessage[];
  document_info: {
    filename: string;
    total_pages: number;
  };
}

// 사용자 인증 관련 타입들
export interface User {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface UserCreate {
  email: string;
  username: string;
  password: string;
  full_name?: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface UserLoginResponse {
  user: User;
  access_token: string;
  token_type: string;
}

export interface AuthError {
  detail: string;
  error_type: string;
}