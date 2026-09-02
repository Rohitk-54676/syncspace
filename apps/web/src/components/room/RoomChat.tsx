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
    <section className="area-chat flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
      <h2 className="text-base font-semibold text-[var(--color-text)]">
        Chat
      </h2>

      <div
        ref={scrollRef}
        className="mt-4 flex h-72 flex-col overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4"
      >
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-[var(--color-text-faint)]">
            <MessageCircle size={22} />

            <p className="text-sm">
              No messages yet. Say hello.
            </p>
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
                      className={`mt-1 max-w-[80%] break-words rounded-xl px-3 py-2 text-sm ${
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
        className="mt-4 flex gap-2"
      >
        <input
          type="text"
          value={chatInput}
          onChange={(event) =>
            onChangeChatInput(event.target.value)
          }
          maxLength={500}
          placeholder="Type a message..."
          aria-label="Chat message"
          className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)]"
        />

        <button
          type="submit"
          disabled={!chatInput.trim()}
          aria-label="Send message"
          className="flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-4 py-3 text-black transition-colors duration-200 hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </form>
    </section>
  );
}