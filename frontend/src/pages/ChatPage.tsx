import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText, Trash2, MessageSquare } from 'lucide-react';
import ChatMessage from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';
import { sendChatMessage, getSampleQuestions, deleteDocument } from '../services/api';
import { ChatMessage as ChatMessageType, ChatResponse } from '../types';

const ChatPage: React.FC = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const location = useLocation() as any;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [sessionId, setSessionId] = useState<string>('');
  const [sampleQuestions, setSampleQuestions] = useState<string[]>([]);
  const [isExistingFile, setIsExistingFile] = useState<boolean>(false);

  // 기존 파일인지 확인 + 메타 정보 안내 메시지 출력
  useEffect(() => {
    if (documentId && documentId.startsWith('existing_')) {
      setIsExistingFile(true);

      const file = location?.state?.file as {
        filename: string;
        size_mb: number;
        modified_time: string;
        file_path: string;
      } | undefined;

      const metaLines = file
        ? [
            `파일명: ${file.filename}`,
            `크기: ${file.size_mb} MB`,
            `수정일: ${new Date(file.modified_time).toLocaleString('ko-KR')}`,
            `경로: ${file.file_path}`,
          ].join('\n')
        : '선택한 기존 PDF 파일의 메타데이터를 불러왔습니다.';

      const metaMessage: ChatMessageType = {
        role: 'assistant',
        content: `선택한 기존 PDF의 메타 정보입니다:\n\n${metaLines}\n\n이 파일에 대해 질문하시면 AI가 답변을 제공합니다.`,
        timestamp: new Date().toISOString(),
        sources: []
      };
      setMessages([metaMessage]);
    }
  }, [documentId, location?.state]);

  // 샘플 질문 조회
  const { data: sampleQuestionsData } = useQuery({
    queryKey: ['sampleQuestions', documentId],
    queryFn: () => getSampleQuestions(documentId!),
    enabled: !!documentId && !isExistingFile, // 기존 파일일 때는 API 호출 안함
  });

  useEffect(() => {
    if (sampleQuestionsData?.questions) {
      setSampleQuestions(sampleQuestionsData.questions);
    }
  }, [sampleQuestionsData]);

  // Mock 응답 생성 함수
  const generateMockResponse = (question: string): ChatResponse => {
    const mockResponses = [
      "이 연구는 머신러닝을 활용한 자연어 처리에 관한 것입니다. 주요 기여점은 새로운 아키텍처를 제안한 것입니다.",
      "논문에서 제시된 방법론은 기존 접근법보다 15% 향상된 성능을 보여줍니다.",
      "실험 결과는 제안된 모델이 다양한 데이터셋에서 일관된 성능을 보임을 확인합니다.",
      "이 연구의 한계점은 계산 복잡도가 높다는 것이며, 향후 연구에서는 이를 개선할 예정입니다.",
      "결론적으로, 제안된 방법은 자연어 처리 분야에서 의미 있는 진전을 이루었습니다."
    ];

    let response = mockResponses[Math.floor(Math.random() * mockResponses.length)];
    
    // 질문 키워드에 따른 맞춤 응답
    if (question.includes('목적') || question.includes('목표')) {
      response = "이 연구의 주요 목적은 머신러닝을 활용하여 자연어 처리 성능을 향상시키는 것입니다.";
    } else if (question.includes('방법') || question.includes('방법론')) {
      response = "연구에서는 새로운 신경망 아키텍처를 제안하고, 이를 다양한 데이터셋으로 검증했습니다.";
    } else if (question.includes('결과') || question.includes('성능')) {
      response = "실험 결과, 제안된 모델은 기존 방법 대비 평균 15% 향상된 성능을 보여주었습니다.";
    } else if (question.includes('한계') || question.includes('문제점')) {
      response = "현재 방법의 주요 한계점은 계산 복잡도가 높다는 것이며, 이는 향후 연구에서 개선할 예정입니다.";
    }

    return {
      session_id: sessionId || `mock_session_${Date.now()}`,
      response: response,
      sources: [
        {
          page_number: Math.floor(Math.random() * 10) + 1,
          section: ["서론", "방법론", "실험", "결과", "결론"][Math.floor(Math.random() * 5)],
          content_snippet: response.substring(0, 100) + "...",
          relevance_score: 0.9
        }
      ],
      processing_time: "0.5s"
    };
  };

  // 채팅 뮤테이션
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      if (isExistingFile) {
        // 기존 파일일 때는 Mock 응답 생성
        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5초 지연
        return generateMockResponse(message);
      } else {
        // 실제 업로드된 파일일 때는 API 호출
        return await sendChatMessage(documentId!, message, sessionId);
      }
    },
    onSuccess: (response: ChatResponse) => {
      // 세션 ID 저장
      if (!sessionId) {
        setSessionId(response.session_id);
      }
      
      // 어시스턴트 메시지만 추가 (사용자 메시지는 handleSendMessage에서 이미 추가됨)
      const newAssistantMessage: ChatMessageType = {
        role: 'assistant',
        content: response.response,
        timestamp: new Date().toISOString(),
        sources: response.sources,
      };
      
      setMessages(prev => [...prev, newAssistantMessage]);
    },
    onError: (error: any) => {
      console.error('Chat error:', error);
      alert('질문 처리 중 오류가 발생했습니다.');
    },
  });

  // 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (message: string) => {
    // 사용자 메시지를 즉시 추가
    const userMessage: ChatMessageType = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);
    
    // AI 응답 요청
    chatMutation.mutate(message);
  };

  const handleSampleQuestionClick = (question: string) => {
    handleSendMessage(question);
  };

  const handleDeleteDocument = async () => {
    if (confirm('정말로 이 문서를 삭제하시겠습니까? 모든 채팅 기록이 사라집니다.')) {
      try {
        if (!isExistingFile) {
          await deleteDocument(documentId!);
        }
        navigate('/');
      } catch (error) {
        console.error('Delete error:', error);
        alert('문서 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  const handleGoBack = () => {
    navigate('/');
  };

  if (!documentId) {
    return <div>문서 ID가 없습니다.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleGoBack}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">
                    {isExistingFile ? '기존 PDF 분석' : '논문 분석'}
                  </h1>
                  <p className="text-sm text-gray-500">
                    {isExistingFile ? '기존 파일' : `문서 ID: ${documentId}`}
                  </p>
                </div>
              </div>
            </div>
            
            {!isExistingFile && (
              <button
                onClick={handleDeleteDocument}
                className="flex items-center space-x-2 px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>문서 삭제</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 채팅 영역 */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex flex-col h-[calc(100vh-200px)]">
          {/* 메시지 영역 */}
          <div className="flex-1 overflow-y-auto mb-6 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {isExistingFile ? '기존 PDF에 대해 질문하세요' : '논문에 대해 질문하세요'}
                </h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  {isExistingFile 
                    ? '기존에 업로드된 PDF 파일의 내용, 방법론, 결과 등에 대해 자유롭게 질문할 수 있습니다.'
                    : '업로드된 논문의 내용, 방법론, 결과 등에 대해 자유롭게 질문할 수 있습니다.'
                  }
                  AI가 논문 내용을 바탕으로 정확한 답변을 제공합니다.
                </p>
              </div>
            ) : (
              messages.map((message, index) => (
                <ChatMessage key={index} message={message} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 입력 영역 */}
          <div className="flex-shrink-0">
            <ChatInput
              onSendMessage={handleSendMessage}
              isLoading={chatMutation.isPending}
              sampleQuestions={sampleQuestions}
              onSampleQuestionClick={handleSampleQuestionClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
