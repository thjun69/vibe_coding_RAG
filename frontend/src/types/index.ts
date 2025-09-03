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
