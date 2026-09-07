"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Send } from "lucide-react";
import type { ChatMessage } from "@syncspace/shared";

interface RoomChatProps {
  messages: ChatMessage[];
  chatInput: string;
  onChangeChatInput: (value: string) => void;
  onSendMessage: (event: React.FormEvent<HTMLFormElement>) => void;
  currentParticipantId: string;
}

export default function RoomChat({
  messages,
  chatInput,
  onChangeChatInput,
  onSendMessage,
  currentParticipantId,
}: RoomChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;

    if (!el) {
      return;
    }

    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <section className="room-chat-slot bg-[var(--color-bg)]">
      <div
        ref={scrollRef}
        className="chat-scroll flex flex-col px-3 py-3 sm:px-5"
      >
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center text-[var(--color-text-faint)]">
            <MessageCircle size={20} />

            <p className="text-sm">No messages yet. Say hello.</p>
          </div>
        ) : (
          <div className="mt-auto space-y-3">
            <AnimatePresence initial={false}>
              {messages.map((message) => {
                const isMe =
                  message.participantId === currentParticipantId;

                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex flex-col ${
                      isMe ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`flex items-baseline gap-2 px-1 ${
                        isMe ? "flex-row-reverse" : ""
                      }`}
                    >
                      <span className="text-xs font-medium text-[var(--color-text-muted)]">
                        {isMe ? "You" : message.displayName}
                      </span>

                      <span className="text-[11px] text-[var(--color-text-faint)]">
                        {new Date(
                          message.createdAt,
                        ).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <p
                      className={`mt-1 max-w-[85%] break-words rounded-xl px-3 py-2 text-sm ${
                        isMe
                          ? "bg-[var(--color-accent-soft)] text-[var(--color-text)]"
                          : "bg-[var(--color-surface-3)] text-[var(--color-text)]"
                      }`}
                    >
                      {message.message}
                    </p>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <form
        onSubmit={onSendMessage}
        className="chat-input-row flex gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 sm:px-5"
      >
        <input
          type="text"
          value={chatInput}
          onChange={(event) => onChangeChatInput(event.target.value)}
          maxLength={500}
          placeholder="Type a message..."
          aria-label="Chat message"
          className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)]"
        />

        <button
          type="submit"
          disabled={!chatInput.trim()}
          aria-label="Send message"
          className="flex shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)] px-3.5 py-2.5 text-black transition-colors duration-200 hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </form>
    </section>
  );
}