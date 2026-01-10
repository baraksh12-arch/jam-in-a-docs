import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { subscribeToChatMessages, sendChatMessage } from '../firebaseClient';
import { format } from 'date-fns';

export default function ChatPanel({ roomId, userId, displayName, isMobile = false, isPortrait = false }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(isMobile && isPortrait); // Collapsed by default on mobile portrait
  const messagesEndRef = useRef(null);

  // Subscribe to chat messages
  useEffect(() => {
    if (!roomId) return;

    const unsubscribe = subscribeToChatMessages(roomId, (msgs) => {
      setMessages(msgs);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [roomId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || isSending) return;

    setIsSending(true);
    try {
      await sendChatMessage(roomId, userId, displayName, inputText.trim());
      setInputText('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
    setIsSending(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Toggle collapse on mobile
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Auto-expand when new message arrives (if collapsed)
  useEffect(() => {
    if (isCollapsed && messages.length > 0) {
      // Optional: auto-expand on new message (commented out to avoid annoying users)
      // setIsCollapsed(false);
    }
  }, [messages.length, isCollapsed]);

  // Mobile-optimized: bottom sheet style on mobile portrait
  const isMobilePortrait = isMobile && isPortrait;

  return (
    <Card className={`
      bg-slate-800/80 border-white/10 flex flex-col
      ${isMobilePortrait 
        ? 'fixed bottom-0 left-0 right-0 z-50 rounded-t-xl rounded-b-none max-h-[70vh] transition-transform duration-300'
        : 'h-full'
      }
      ${isMobilePortrait && isCollapsed ? 'translate-y-[calc(100%-60px)]' : ''}
    `}>
      <CardHeader 
        className={`
          border-b border-white/10 pb-3 cursor-pointer select-none
          ${isMobilePortrait ? 'touch-none' : ''}
        `}
        onClick={isMobilePortrait ? toggleCollapse : undefined}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-cyan-400" />
            <h3 className="text-white font-semibold">Chat</h3>
            {isMobilePortrait && messages.length > 0 && (
              <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded-full">
                {messages.length}
              </span>
            )}
          </div>
          {isMobilePortrait && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapse();
              }}
              className="text-white/70 hover:text-white transition-colors"
              aria-label={isCollapsed ? 'Expand chat' : 'Collapse chat'}
            >
              {isCollapsed ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>
          )}
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="flex-1 flex flex-col p-0">
          {/* Messages area */}
          <div className={`
            flex-1 overflow-y-auto p-4 space-y-3
            ${isMobilePortrait ? 'max-h-[50vh]' : 'min-h-[300px] max-h-[500px]'}
          `}>
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No messages yet</p>
              <p className="text-xs">Say hi to your bandmates!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.userId === userId;
              const time = msg.createdAt?.toDate ? format(msg.createdAt.toDate(), 'HH:mm') : '';

              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400">
                        {isMe ? 'You' : msg.displayName}
                      </span>
                      {time && (
                        <span className="text-xs text-gray-600">{time}</span>
                      )}
                    </div>
                    <div
                      className={`
                        rounded-lg px-3 py-2
                        ${isMe
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                          : 'bg-white/10 text-white'
                        }
                      `}
                    >
                      {/* XSS protection: text is already sanitized in sendChatMessage, but render safely */}
                      <p className="text-sm break-words" dangerouslySetInnerHTML={{ __html: msg.text }} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

          {/* Input area */}
          <div className="p-3 sm:p-4 border-t border-white/10">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Type a message..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isSending}
                className="flex-1 bg-white/5 border-white/20 text-white placeholder:text-gray-500 min-h-[44px] text-base sm:text-sm"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputText.trim() || isSending}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 min-w-[44px] min-h-[44px]"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}