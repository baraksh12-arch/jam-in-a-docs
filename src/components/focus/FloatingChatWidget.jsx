import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Minimize2, Maximize2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { subscribeToChatMessages, sendChatMessage } from '../firebaseClient';
import { format } from 'date-fns';

/**
 * FloatingChatWidget - Compact, draggable chat widget for Focus Mode
 * Premium glass morphism design with minimal footprint
 */
export default function FloatingChatWidget({
  roomId,
  userId,
  displayName,
  onClose
}) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);
  const wasExpandedRef = useRef(false);

  useEffect(() => {
    if (!roomId) return;

    const unsubscribe = subscribeToChatMessages(roomId, (msgs) => {
      const prevLength = messages.length;
      setMessages(msgs);
      
      // Track unread when collapsed
      if (!isExpanded && msgs.length > prevLength && wasExpandedRef.current) {
        setUnreadCount(prev => prev + (msgs.length - prevLength));
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [roomId, isExpanded]);

  useEffect(() => {
    if (isExpanded) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnreadCount(0);
      wasExpandedRef.current = true;
    }
  }, [messages, isExpanded]);

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

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0, y: 20 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={`
        relative overflow-hidden
        backdrop-blur-2xl bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90
        border border-white/10 rounded-2xl
        shadow-2xl shadow-black/40
        transition-all duration-300 ease-out
        ${isExpanded ? 'w-80 h-96' : 'w-72 h-14'}
      `}
    >
      {/* Gradient border effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/20 via-transparent to-fuchsia-500/20 pointer-events-none opacity-50" />
      
      {/* Header */}
      <div 
        className="relative flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            {unreadCount > 0 && !isExpanded && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 flex items-center justify-center"
              >
                <span className="text-[10px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>
              </motion.div>
            )}
          </div>
          <div>
            <span className="text-white font-semibold text-sm">Chat</span>
            {!isExpanded && (
              <span className="text-white/40 text-xs ml-2">{messages.length} messages</span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-[calc(100%-56px)]"
          >
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-3 space-y-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-white/30 text-sm">No messages yet</p>
                </div>
              ) : (
                messages.slice(-20).map((msg, index) => {
                  const isMe = msg.userId === userId;
                  
                  let time = '';
                  if (msg.createdAt) {
                    if (msg.createdAt.toDate) {
                      time = format(msg.createdAt.toDate(), 'HH:mm');
                    } else {
                      time = format(new Date(msg.createdAt), 'HH:mm');
                    }
                  }

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`
                        max-w-[85%] px-3 py-2 rounded-xl
                        ${isMe 
                          ? 'bg-gradient-to-r from-violet-500/80 to-fuchsia-500/80 text-white' 
                          : 'bg-white/10 text-white/90'
                        }
                      `}>
                        {!isMe && (
                          <p className="text-[10px] text-white/50 font-medium mb-0.5">
                            {msg.displayName}
                          </p>
                        )}
                        <p className="text-sm break-words">{msg.text}</p>
                        <p className="text-[9px] text-white/30 mt-1 text-right">{time}</p>
                      </div>
                    </motion.div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="p-3 border-t border-white/5">
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="Message..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isSending}
                  className="
                    flex-1 h-9 text-sm
                    bg-white/5 border-white/10 text-white placeholder:text-white/30
                    focus:bg-white/10 focus:border-violet-500/50
                    rounded-xl
                  "
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputText.trim() || isSending}
                  className={`
                    p-2 rounded-xl transition-all
                    ${inputText.trim() 
                      ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30' 
                      : 'bg-white/5 text-white/30'
                    }
                  `}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
