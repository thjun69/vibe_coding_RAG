import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText, Trash2, MessageSquare } from 'lucide-react';
import ChatMessage from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';
import { sendChatMessage, sendMultiChatMessage, getSampleQuestions, deleteDocument, getMyDocuments } from '../services/api';
import { ChatMessage as ChatMessageType, ChatResponse } from '../types';

const ChatPage: React.FC = () => {
  const { documentId: paramDocumentId } = useParams<{ documentId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation() as any;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // URL 파라미터 또는 쿼리 파라미터에서 문서 ID 가져오기
  const documentId = paramDocumentId || searchParams.get('document');
  
  // 멀티 문서 처리: 쿼리 파라미터에서 documents 배열 가져오기 (메모이제이션)
  const multiDocuments = useMemo(() => searchParams.getAll('documents'), [searchParams]);
  const isMultiDocument = multiDocuments.length >= 1;
  
  console.log('🔍 ChatPage 초기화:', {
    paramDocumentId,
    documentId,
    multiDocuments,
    isMultiDocument,
    searchParams: searchParams.toString()
  });
  
  // 데모 모드 확인
  const isDemoMode = searchParams.get('demo') === 'true';
  
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [sessionId, setSessionId] = useState<string>('');
  const [sampleQuestions, setSampleQuestions] = useState<string[]>([]);
  const [isExistingFile, setIsExistingFile] = useState<boolean>(false);
  const [documentNames, setDocumentNames] = useState<string[]>([]);

  // 문서 정보 가져오기
  const { data: documentsData } = useQuery({
    queryKey: ['myDocuments'],
    queryFn: getMyDocuments,
    enabled: !isDemoMode && !isExistingFile && (!!documentId || isMultiDocument) && (!documentId || !documentId.startsWith('existing_')),
  });

  // 문서명 추출
  useEffect(() => {
    console.log('🔍 문서명 추출 useEffect 실행:', {
      documentsData: !!documentsData,
      user_documents_count: documentsData?.user_documents?.length || 0,
      isMultiDocument,
      multiDocuments,
      multiDocumentsLength: multiDocuments.length,
      documentId
    });

    if (documentsData && documentsData.user_documents) {
      if (isMultiDocument && multiDocuments.length >= 1) {
        // 멀티 문서인 경우
        console.log('📚 멀티 문서 처리 중:', multiDocuments);
        const names = multiDocuments.map(docId => {
          const doc = documentsData.user_documents.find(d => d.document_id === docId);
          console.log(`문서 ID ${docId} 찾기:`, doc ? doc.filename : '문서를 찾을 수 없음');
          return doc ? doc.filename : `문서 ${docId}`;
        });
        console.log('📝 추출된 문서명들:', names);
        setDocumentNames(names);
      } else if (documentId && !isMultiDocument) {
        // 단일 문서인 경우 (멀티문서가 아닐 때만)
        console.log('📄 단일 문서 처리 중:', documentId);
        const doc = documentsData.user_documents.find(d => d.document_id === documentId);
        if (doc) {
          console.log('📝 단일 문서명:', doc.filename);
          setDocumentNames([doc.filename]);
        }
      }
    }
  }, [documentsData, documentId, isMultiDocument, multiDocuments.join(',')]);

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
    } else if (isDemoMode && documentId === 'demo_sample_paper') {
      // 데모 모드 초기 메시지
      const demoMessage: ChatMessageType = {
        role: 'assistant',
        content: `🎉 **AI 논문 분석 데모에 오신 것을 환영합니다!**

이 데모에서는 가상의 연구 논문을 바탕으로 AI와의 대화를 체험할 수 있습니다.

**📚 데모 논문 정보:**
- 제목: "Transformer 기반 자연어 처리 모델의 성능 향상 연구"
- 저자: AI Research Team
- 페이지: 15페이지
- 분야: 머신러닝, 자연어 처리

**💡 체험해볼 수 있는 질문들:**
• 이 연구의 주요 목적은 무엇인가요?
• 제안된 방법론의 핵심 아이디어는?
• 실험 결과는 어떻게 나왔나요?
• 기존 방법과 비교했을 때 어떤 장점이 있나요?

자유롭게 질문해보세요! AI가 논문 내용을 바탕으로 답변을 제공합니다.`,
        timestamp: new Date().toISOString(),
        sources: []
      };
      setMessages([demoMessage]);
    }
  }, [documentId, location?.state, isDemoMode]);

  // 샘플 질문 조회
  const { data: sampleQuestionsData } = useQuery({
    queryKey: ['sampleQuestions', documentId],
    queryFn: () => getSampleQuestions(documentId!),
    enabled: !!documentId && !isExistingFile && !isDemoMode, // 기존 파일이나 데모 모드일 때는 API 호출 안함
  });

  useEffect(() => {
    if (sampleQuestionsData?.questions) {
      setSampleQuestions(sampleQuestionsData.questions);
    }
  }, [sampleQuestionsData]);

  // 데모용 응답 생성 함수
  const generateDemoResponse = (question: string): ChatResponse => {
    const demoResponses = {
      '목적': "이 연구의 주요 목적은 Transformer 아키텍처의 성능을 향상시키는 새로운 attention 메커니즘을 제안하는 것입니다. 기존 Transformer의 계산 복잡도 문제를 해결하면서도 성능은 유지하거나 향상시키는 것이 핵심 목표입니다.",
      '방법론': "제안된 방법론은 'Efficient Multi-Head Attention (EMHA)'로, 기존의 모든 헤드에 대해 attention을 계산하는 대신, 동적으로 중요한 헤드만 선택하여 계산하는 방식입니다. 이를 통해 계산량을 40% 줄이면서도 성능은 유지할 수 있습니다.",
      '결과': "실험 결과, 제안된 EMHA 모델은 기존 Transformer 대비 GLUE 벤치마크에서 평균 2.3% 향상된 성능을 보여주었습니다. 특히 계산 효율성 측면에서는 2.1배 빠른 추론 속도를 달성했습니다.",
      '장점': "기존 방법과 비교했을 때 주요 장점은: 1) 계산 효율성 향상 (40% 감소), 2) 메모리 사용량 절약, 3) 실시간 처리 가능성, 4) 모바일/엣지 디바이스 배포 적합성입니다.",
      '한계': "현재 방법의 주요 한계점은: 1) 매우 긴 시퀀스에서의 성능 저하, 2) 특정 도메인에 대한 일반화 능력 제한, 3) 하이퍼파라미터 튜닝의 복잡성입니다.",
      '기술': "핵심 기술은 'Dynamic Head Selection'과 'Adaptive Attention Computation'입니다. 입력 시퀀스의 특성을 분석하여 필요한 attention 패턴만 계산하는 방식으로 구현됩니다.",
      '데이터셋': "실험에는 GLUE 벤치마크, SQuAD, 그리고 자체 구축한 한국어 데이터셋을 사용했습니다. 총 15개 태스크에서 일관된 성능 향상을 확인했습니다.",
      '향후': "향후 연구 방향은: 1) 더 긴 시퀀스 지원, 2) 다국어 모델로의 확장, 3) 실제 서비스 환경에서의 성능 검증, 4) 하드웨어 최적화 등입니다."
    };

    let response = "";
    const questionLower = question.toLowerCase();
    
    // 질문 키워드에 따른 맞춤 응답
    if (questionLower.includes('목적') || questionLower.includes('목표') || questionLower.includes('의도')) {
      response = demoResponses['목적'];
    } else if (questionLower.includes('방법') || questionLower.includes('방법론') || questionLower.includes('접근')) {
      response = demoResponses['방법론'];
    } else if (questionLower.includes('결과') || questionLower.includes('성능') || questionLower.includes('실험')) {
      response = demoResponses['결과'];
    } else if (questionLower.includes('장점') || questionLower.includes('장점') || questionLower.includes('우위')) {
      response = demoResponses['장점'];
    } else if (questionLower.includes('한계') || questionLower.includes('문제점') || questionLower.includes('단점')) {
      response = demoResponses['한계'];
    } else if (questionLower.includes('기술') || questionLower.includes('구현') || questionLower.includes('아키텍처')) {
      response = demoResponses['기술'];
    } else if (questionLower.includes('데이터') || questionLower.includes('데이터셋') || questionLower.includes('검증')) {
      response = demoResponses['데이터셋'];
    } else if (questionLower.includes('향후') || questionLower.includes('미래') || questionLower.includes('다음')) {
      response = demoResponses['향후'];
    } else {
      // 일반적인 질문에 대한 응답
      response = "이 연구는 Transformer 기반 자연어 처리 모델의 성능을 향상시키는 새로운 attention 메커니즘을 제안합니다. 주요 특징은 계산 효율성을 크게 향상시키면서도 성능은 유지하거나 향상시킨다는 점입니다. 구체적인 내용에 대해 더 자세히 질문해주시면 상세히 답변드리겠습니다.";
    }

    return {
      session_id: sessionId || `demo_session_${Date.now()}`,
      response: response,
      sources: [
        {
          page_number: Math.floor(Math.random() * 15) + 1,
          section: ["서론", "관련 연구", "방법론", "실험", "결과", "토론", "결론"][Math.floor(Math.random() * 7)],
          content_snippet: response.substring(0, 120) + "...",
          relevance_score: 0.95
        }
      ],
      processing_time: "0.8s"
    };
  };

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
      if (isDemoMode && documentId === 'demo_sample_paper') {
        // 데모 모드일 때는 데모용 응답 생성
        await new Promise(resolve => setTimeout(resolve, 800)); // 0.8초 지연
        return generateDemoResponse(message);
      } else if (isExistingFile) {
        // 기존 파일일 때는 Mock 응답 생성
        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5초 지연
        return generateMockResponse(message);
      } else if (isMultiDocument && multiDocuments.length > 1) {
        // 멀티 문서 채팅
        return await sendMultiChatMessage(multiDocuments, message, sessionId);
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
          
          // 문서 삭제 후 전역 이벤트 발생 (문서 목록 새로고침용)
          const deleteEvent = new CustomEvent('documentDeleted', {
            detail: { documentId: documentId }
          });
          window.dispatchEvent(deleteEvent);
          
          // localStorage에 삭제 이벤트 기록
          localStorage.setItem('lastDocumentDelete', JSON.stringify({
            documentId: documentId,
            timestamp: Date.now()
          }));
          
          console.log('🗑️ 문서 삭제 완료 및 이벤트 발생:', documentId);
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

  if (!documentId && !isMultiDocument) {
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
                    {isDemoMode 
                      ? '🚀 AI 논문 분석 데모'
                      : isMultiDocument 
                        ? `멀티 문서 분석 (${multiDocuments.length}개)`
                        : isExistingFile 
                          ? '기존 PDF 분석' 
                          : '논문 분석'
                    }
                  </h1>
                  <p className="text-sm text-gray-500">
                    {(() => {
                      console.log('🔍 헤더 표시 로직:', {
                        isDemoMode,
                        isMultiDocument,
                        documentNames,
                        documentNamesLength: documentNames.length,
                        multiDocumentsLength: multiDocuments.length,
                        isExistingFile,
                        documentId
                      });
                      
                      if (isDemoMode) {
                        return '가상 논문으로 AI 분석 체험하기';
                      } else if (isMultiDocument) {
                        if (documentNames.length > 0) {
                          return `분석 대상: ${documentNames.join(', ')}`;
                        } else {
                          return `${multiDocuments.length}개 문서에서 통합 검색`;
                        }
                      } else if (isExistingFile) {
                        return '기존 파일';
                      } else if (documentNames.length > 0) {
                        return documentNames[0];
                      } else {
                        return `문서 ID: ${documentId}`;
                      }
                    })()}
                  </p>
                </div>
              </div>
            </div>
            
                         {!isExistingFile && !isDemoMode && (
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
                   {isDemoMode 
                     ? '데모 논문에 대해 질문하세요' 
                     : isExistingFile 
                       ? '기존 PDF에 대해 질문하세요' 
                       : '논문에 대해 질문하세요'
                   }
                 </h3>
                 <p className="text-gray-600 max-w-md mx-auto">
                   {isDemoMode 
                     ? '가상의 연구 논문에 대해 질문해보세요. AI가 논문 내용을 바탕으로 상세한 답변을 제공합니다.'
                     : isExistingFile 
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
