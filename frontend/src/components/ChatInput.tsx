import React, { useState, useRef, useEffect } from 'react';
import { Send, Lightbulb } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  sampleQuestions?: string[];
  onSampleQuestionClick?: (question: string) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  isLoading = false, 
  sampleQuestions = [],
  onSampleQuestionClick 
}) => {
  const [message, setMessage] = useState('');
  const [showSampleQuestions, setShowSampleQuestions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSendMessage(message.trim());
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleSampleQuestionClick = (question: string) => {
    setMessage(question);
    setShowSampleQuestions(false);
    if (onSampleQuestionClick) {
      onSampleQuestionClick(question);
    }
    textareaRef.current?.focus();
  };

  return (
    <div className="w-full">
      {/* 샘플 질문 */}
      {sampleQuestions.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowSampleQuestions(!showSampleQuestions)}
            className="flex items-center space-x-2 text-sm text-primary-600 hover:text-primary-700 transition-colors"
          >
            <Lightbulb className="w-4 h-4" />
            <span>샘플 질문 보기</span>
          </button>
          
          {showSampleQuestions && (
            <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-medium text-blue-800 mb-3">추천 질문:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {sampleQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleSampleQuestionClick(question)}
                    className="text-left p-2 text-sm text-blue-700 hover:bg-blue-100 rounded transition-colors text-balance"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 채팅 입력 폼 */}
      <form onSubmit={handleSubmit} className="flex items-end space-x-3">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="논문에 대해 질문하세요..."
            className="input-field resize-none min-h-[44px] max-h-32 overflow-y-auto"
            rows={1}
            disabled={isLoading}
          />
          
          {/* 글자 수 표시 */}
          <div className="absolute bottom-2 right-2 text-xs text-gray-400">
            {message.length}/1000
          </div>
        </div>
        
        <button
          type="submit"
          disabled={!message.trim() || isLoading}
          className={`
            p-3 rounded-lg transition-all duration-200 flex items-center justify-center
            ${!message.trim() || isLoading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm hover:shadow-md'
            }
          `}
        >
          {isLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </form>
      
      {/* 입력 팁 */}
      <div className="mt-2 text-xs text-gray-500">
        Enter로 전송, Shift+Enter로 줄바꿈
      </div>
    </div>
  );
};

export default ChatInput;
