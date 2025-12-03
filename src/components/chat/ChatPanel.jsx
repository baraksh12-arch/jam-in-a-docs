import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, MessageCircle } from 'lucide-react';
import { subscribeToChatMessages, sendChatMessage } from '../.@/api/functions/firebaseClient';
import { format } from 'date-fns';

export default function ChatPanel({ roomId, userId, displayName }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
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

  return (
    <Card className="bg-slate-800/80 border-white/10 h-full flex flex-col">
      <CardHeader className="border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-cyan-400" />
          <h3 className="text-white font-semibold">Chat</h3>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[500px]">
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
                      <p className="text-sm break-words">{msg.text}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="p-4 border-t border-white/10">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Type a message..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isSending}
              className="flex-1 bg-white/5 border-white/20 text-white placeholder:text-gray-500"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputText.trim() || isSending}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}