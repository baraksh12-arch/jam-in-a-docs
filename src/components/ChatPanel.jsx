import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, MessageCircle, Smile, ChevronDown, ChevronUp } from 'lucide-react';
import { subscribeToChatMessages, sendChatMessage } from './firebaseClient';
import { format } from 'date-fns';

export default function ChatPanel({ roomId, userId, displayName }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!roomId) return;

    const unsubscribe = subscribeToChatMessages(roomId, (msgs) => {
      setMessages(msgs);
      // Update unread count if collapsed
      if (isCollapsed && msgs.length > messages.length) {
        setUnreadCount(prev => prev + (msgs.length - messages.length));
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [roomId, isCollapsed]);

  useEffect(() => {
    if (!isCollapsed) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnreadCount(0);
    }
  }, [messages, isCollapsed]);

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

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    if (isCollapsed) {
      setUnreadCount(0);
    }
  };

  return (
    <div className={`
      relative rounded-2xl overflow-hidden transition-all duration-300 ease-out
      bg-gradient-to-b from-slate-800/90 to-slate-900/90 backdrop-blur-xl
      border border-white/10 shadow-2xl shadow-black/30
      ${isCollapsed ? 'h-14' : 'h-auto'}
    `}>
      {/* Header - Always visible */}
      <button 
        onClick={toggleCollapse}
        className="w-full flex items-center justify-between px-4 py-3.5 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            {unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                {unreadCount > 9 ? '9+' : unreadCount}
              </div>
            )}
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-white">Chat</h3>
            <p className="text-xs text-gray-500">{messages.length} messages</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isCollapsed ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Collapsible content */}
      <div className={`transition-all duration-300 ease-out ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'}`}>
        {/* Messages area */}
        <div 
          ref={containerRef}
          className="overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[350px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center mb-4 border border-white/5">
                <Smile className="w-8 h-8 text-gray-500" />
              </div>
              <p className="text-gray-400 font-medium mb-1">No messages yet</p>
              <p className="text-gray-600 text-sm">Say hi to your bandmates!</p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isMe = msg.userId === userId;
              const showAvatar = index === 0 || messages[index - 1]?.userId !== msg.userId;
              
              // Handle both Firestore Timestamp (old) and ISO string (new)
              let time = '';
              if (msg.createdAt) {
                if (msg.createdAt.toDate) {
                  time = format(msg.createdAt.toDate(), 'HH:mm');
                } else {
                  time = format(new Date(msg.createdAt), 'HH:mm');
                }
              }

              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} ${showAvatar ? 'mt-4' : 'mt-1'}`}
                >
                  {/* Avatar placeholder */}
                  {showAvatar ? (
                    <div className={`
                      w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold
                      ${isMe 
                        ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white' 
                        : 'bg-gradient-to-br from-cyan-500 to-blue-500 text-white'
                      }
                    `}>
                      {(isMe ? 'You' : msg.displayName)?.[0]?.toUpperCase() || '?'}
                    </div>
                  ) : (
                    <div className="w-7 flex-shrink-0" />
                  )}
                  
                  <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                    {/* Name and time */}
                    {showAvatar && (
                      <div className={`flex items-center gap-2 mb-1 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                        <span className="text-xs font-medium text-gray-400">
                          {isMe ? 'You' : msg.displayName || 'Anonymous'}
                        </span>
                        {time && (
                          <span className="text-xs text-gray-600">{time}</span>
                        )}
                      </div>
                    )}
                    
                    {/* Message bubble */}
                    <div
                      className={`
                        rounded-2xl px-4 py-2.5 shadow-sm
                        ${isMe
                          ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-br-md'
                          : 'bg-white/10 text-gray-100 rounded-bl-md border border-white/5'
                        }
                      `}
                    >
                      <p className="text-sm break-words leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="p-3 border-t border-white/5 bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Input
                type="text"
                placeholder="Type a message..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isSending}
                className="
                  w-full h-11 pl-4 pr-4 rounded-xl
                  bg-white/5 border-white/10 text-white placeholder:text-gray-500
                  focus:bg-white/10 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20
                  transition-all duration-200
                "
              />
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!inputText.trim() || isSending}
              className={`
                h-11 w-11 p-0 rounded-xl transition-all duration-200 flex-shrink-0
                ${inputText.trim() 
                  ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-90 text-white shadow-lg shadow-violet-500/25' 
                  : 'bg-white/5 text-gray-500 border border-white/10'
                }
              `}
            >
              <Send className={`w-4 h-4 ${inputText.trim() ? '' : ''}`} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
