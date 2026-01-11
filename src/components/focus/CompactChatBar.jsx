import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, MessageCircle, ChevronUp } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';

/**
 * CompactChatBar - Minimal chat interface for Focus Mode
 * 
 * Shows last few messages in a slim bar at the bottom
 * Expands on click to show more messages and input
 */

export default function CompactChatBar({ 
  roomId, 
  userId, 
  displayName, 
  onClose,
  isExpanded = false,
  onToggleExpand
}) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Fetch and subscribe to messages
  useEffect(() => {
    if (!roomId) return;

    // Fetch existing messages
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setMessages(data.reverse());
      }
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`chat:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          setMessages(prev => [...prev.slice(-49), payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isExpanded && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isExpanded]);

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    const { error } = await supabase.from('messages').insert({
      room_id: roomId,
      user_id: userId,
      display_name: displayName,
      content: newMessage.trim()
    });

    if (!error) {
      setNewMessage('');
    }
    setSending(false);
  }, [newMessage, roomId, userId, displayName, sending]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const lastMessages = messages.slice(-3);

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <AnimatePresence mode="wait">
        {isExpanded ? (
          // Expanded view
          <motion.div
            key="expanded"
            initial={{ height: 56 }}
            animate={{ height: 280 }}
            exit={{ height: 56 }}
            className="bg-black/90 backdrop-blur-xl border-t border-white/10"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-violet-400" />
                <span className="text-white/70 text-sm font-medium">Chat</span>
                <span className="text-white/40 text-xs">({messages.length})</span>
              </div>
              <button
                onClick={onToggleExpand}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ChevronUp className="w-4 h-4 text-white/50 rotate-180" />
              </button>
            </div>

            {/* Messages */}
            <div className="h-[160px] overflow-y-auto px-4 py-2 space-y-2">
              {messages.length === 0 ? (
                <div className="text-center text-white/30 text-sm py-8">
                  No messages yet. Say hi! 👋
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <motion.div
                    key={msg.id || idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex gap-2 ${msg.user_id === userId ? 'flex-row-reverse' : ''}`}
                  >
                    <div
                      className={`
                        max-w-[80%] px-3 py-1.5 rounded-2xl text-sm
                        ${msg.user_id === userId
                          ? 'bg-violet-500/30 text-white'
                          : 'bg-white/10 text-white/90'
                        }
                      `}
                    >
                      {msg.user_id !== userId && (
                        <span className="text-xs text-white/50 block mb-0.5">
                          {msg.display_name}
                        </span>
                      )}
                      {msg.content}
                    </div>
                  </motion.div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-2 border-t border-white/10">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message..."
                  className="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-2 text-white placeholder-white/30 text-sm focus:outline-none focus:border-violet-500/50"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="p-2.5 bg-violet-500 hover:bg-violet-400 disabled:bg-white/10 disabled:text-white/30 rounded-xl transition-colors"
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          // Collapsed bar view
          <motion.div
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onToggleExpand}
            className="bg-black/80 backdrop-blur-xl border-t border-white/10 cursor-pointer hover:bg-black/90 transition-colors"
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex items-center gap-2 flex-shrink-0">
                <MessageCircle className="w-4 h-4 text-violet-400" />
                <ChevronUp className="w-3 h-3 text-white/40" />
              </div>

              {/* Last messages preview */}
              <div className="flex-1 overflow-hidden">
                {lastMessages.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-white/50 text-xs font-medium flex-shrink-0">
                      {lastMessages[lastMessages.length - 1]?.display_name}:
                    </span>
                    <span className="text-white/80 text-sm truncate">
                      {lastMessages[lastMessages.length - 1]?.content}
                    </span>
                  </div>
                ) : (
                  <span className="text-white/40 text-sm">Tap to chat...</span>
                )}
              </div>

              {/* Message count badge */}
              {messages.length > 0 && (
                <div className="flex-shrink-0 px-2 py-0.5 bg-violet-500/30 rounded-full">
                  <span className="text-violet-300 text-xs font-medium">{messages.length}</span>
                </div>
              )}

              {/* Close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose?.();
                }}
                className="flex-shrink-0 p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-white/40" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
