import React from 'react';
import { User, Bot, FileText, ExternalLink } from 'lucide-react';
import { ChatMessage as ChatMessageType, Source } from '../types';

interface ChatMessageProps {
  message: ChatMessageType;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const timestamp = new Date(message.timestamp).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start space-x-3 max-w-3xl`}>
        {/* 아바타 */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-primary-500' : 'bg-gray-500'
        }`}>
          {isUser ? (
            <User className="w-5 h-5 text-white" />
          ) : (
            <Bot className="w-5 h-5 text-white" />
          )}
        </div>

        {/* 메시지 내용 */}
        <div className={`flex-1 ${isUser ? 'text-right' : 'text-left'}`}>
          <div className={`inline-block p-4 rounded-2xl ${
            isUser 
              ? 'bg-primary-500 text-white' 
              : 'bg-white border border-gray-200 text-gray-900'
          }`}>
            <div className="whitespace-pre-wrap text-balance">
              {message.content}
            </div>
          </div>
          
          {/* 출처 정보 */}
          {!isUser && message.sources && message.sources.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="text-sm text-gray-600 font-medium">출처:</div>
              {message.sources.map((source, index) => (
                <SourceCard key={index} source={source} />
              ))}
            </div>
          )}
          
          {/* 타임스탬프 */}
          <div className={`text-xs text-gray-500 mt-2 ${isUser ? 'text-right' : 'text-left'}`}>
            {timestamp}
          </div>
        </div>
      </div>
    </div>
  );
};

interface SourceCardProps {
  source: Source;
}

const SourceCard: React.FC<SourceCardProps> = ({ source }) => {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 text-sm text-gray-700">
            <FileText className="w-4 h-4" />
            <span className="font-medium">
              {source.page_number}페이지
            </span>
            {source.section && source.section !== 'Unknown' && (
              <>
                <span>•</span>
                <span>{source.section}</span>
              </>
            )}
          </div>
          
          <div className="mt-2 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <span>관련성:</span>
              <div className="flex items-center space-x-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <div
                    key={star}
                    className={`w-3 h-3 rounded-full ${
                      star <= Math.round(source.relevance_score * 5)
                        ? 'bg-yellow-400'
                        : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-500">
                ({Math.round(source.relevance_score * 100)}%)
              </span>
            </div>
          </div>
          
          <div className="mt-2 p-2 bg-white border border-gray-200 rounded text-xs text-gray-700">
            {source.content_snippet}
          </div>
        </div>
        
        <button className="ml-2 p-1 text-gray-400 hover:text-gray-600 transition-colors">
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ChatMessage;
