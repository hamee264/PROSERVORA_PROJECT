import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCheck,
  CircleUserRound,
  LoaderCircle,
  MessageCircle,
  Search,
  Send,
  Smile,
} from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "../../../context/AuthContext";
import {
  getConversationMessages,
  getMyConversations,
  markConversationAsRead,
  sendChatMessage,
} from "../../../services/chatService";

import "./Messages.css";

const getOtherParticipant = (conversation, userId) => {
  const isCustomer = conversation.customer_id === userId;

  return {
    name: [
      isCustomer
        ? conversation.provider_first_name
        : conversation.customer_first_name,
      isCustomer
        ? conversation.provider_last_name
        : conversation.customer_last_name,
    ]
      .filter(Boolean)
      .join(" "),
    avatar: isCustomer
      ? conversation.provider_avatar_url
      : conversation.customer_avatar_url,
  };
};

const formatConversationTime = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat("en", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(date);
};

const formatMessageTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

function Messages({ audience = "client" }) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedConversationId = searchParams.get("conversationId");
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [conversationLoading, setConversationLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [messageText, setMessageText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [error, setError] = useState("");
  const [readAtByConversation, setReadAtByConversation] = useState({});
  const messagesEndRef = useRef(null);
  const composerRef = useRef(null);

  const addEmoji = (emoji) => {
    const textarea = composerRef.current;
    const start = textarea?.selectionStart ?? messageText.length;
    const end = textarea?.selectionEnd ?? messageText.length;
    const nextText = `${messageText.slice(0, start)}${emoji}${messageText.slice(end)}`;

    setMessageText(nextText);
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      textarea?.focus();
      const cursor = start + emoji.length;
      textarea?.setSelectionRange(cursor, cursor);
    });
  };

  useEffect(() => {
    let active = true;

    const loadConversations = async () => {
      try {
        const data = await getMyConversations();
        if (!active) return;

        const items = data?.conversations || [];
        setConversations(items);
        if (items.length > 0) {
          setMessagesLoading(true);
          setMessages([]);
        }
        const requestedConversation = items.find(
          (conversation) => String(conversation.id) === requestedConversationId,
        );

        setActiveConversation(
          (current) => requestedConversation || current || items[0] || null,
        );
      } catch (loadError) {
        if (active) {
          setError(
            loadError.response?.data?.message ||
              "Unable to load your conversations. Please try again.",
          );
        }
      } finally {
        if (active) setConversationLoading(false);
      }
    };

    const refreshConversations = async () => {
      try {
        const data = await getMyConversations();
        if (active) setConversations(data?.conversations || []);
      } catch {
        // Keep the current inbox visible if a background refresh fails.
      }
    };

    loadConversations();
    const interval = window.setInterval(refreshConversations, 15000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [requestedConversationId]);

  useEffect(() => {
    if (!activeConversation?.id) return undefined;

    let active = true;

    const refreshMessages = async () => {
      try {
        const data = await getConversationMessages(activeConversation.id);
        if (!active) return;

        const items = data?.messages || [];
        setMessages(items);

        await markConversationAsRead(activeConversation.id);
        if (active) {
          setReadAtByConversation((current) => ({
            ...current,
            [activeConversation.id]:
              items.at(-1)?.created_at || activeConversation.latest_message_at,
          }));
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError.response?.data?.message ||
              "Unable to load this conversation.",
          );
        }
      } finally {
        if (active) setMessagesLoading(false);
      }
    };

    refreshMessages();

    const interval = window.setInterval(refreshMessages, 8000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [activeConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;

    return conversations.filter((conversation) =>
      getOtherParticipant(conversation, user?.id)
        .name.toLowerCase()
        .includes(query),
    );
  }, [conversations, search, user?.id]);

  const unreadCount = useMemo(
    () =>
      conversations.filter((conversation) => {
        const lastMessageAt = conversation.latest_message_at;
        return (
          conversation.latest_message &&
          conversation.latest_message_sender_id !== user?.id &&
          readAtByConversation[conversation.id] !== lastMessageAt
        );
      }).length,
    [conversations, readAtByConversation, user?.id],
  );

  const handleSelectConversation = (conversation) => {
    setError("");
    setActiveConversation(conversation);
    setMessagesLoading(true);
    setMessages([]);
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    const message = messageText.trim();

    if (!message || !activeConversation || sending) return;

    setError("");
    setSending(true);

    try {
      const data = await sendChatMessage(activeConversation.id, message);
      const newMessage = data?.data;

      if (newMessage) {
        setMessages((current) => [...current, newMessage]);
        setConversations((current) =>
          current
            .map((conversation) =>
              conversation.id === activeConversation.id
                ? {
                    ...conversation,
                    latest_message: newMessage.message,
                    latest_message_at: newMessage.created_at,
                    latest_message_sender_id: user?.id,
                  }
                : conversation,
            )
            .sort(
              (first, second) =>
                new Date(second.latest_message_at || second.created_at) -
                new Date(first.latest_message_at || first.created_at),
            ),
        );
        setReadAtByConversation((current) => ({
          ...current,
          [activeConversation.id]: newMessage.created_at,
        }));
      }

      setMessageText("");
    } catch (sendError) {
      setError(
        sendError.response?.data?.message ||
          "Unable to send your message. Please try again.",
      );
    } finally {
      setSending(false);
    }
  };

  const participant = activeConversation
    ? getOtherParticipant(activeConversation, user?.id)
    : null;
  const isProvider = audience === "provider";
  const workspaceLabel = isProvider ? "PROVIDER WORKSPACE" : "YOUR WORKSPACE";
  const intro = isProvider
    ? "Keep clients informed and move every booking forward with clear communication."
    : "Stay connected with the professionals working on your requests.";

  return (
    <div className="client-messages">
      <header className="client-messages__page-header">
        <span className="client-messages__eyebrow">{workspaceLabel}</span>
        <h1>Messages</h1>
        <p>{intro}</p>
      </header>

      <div
        className={`client-messages__workspace ${
          activeConversation ? "client-messages__workspace--open" : ""
        }`}
      >
        <aside className="client-messages__inbox">
          <header className="client-messages__inbox-header">
            <div>
              <h2>Conversations</h2>
            </div>
            {unreadCount > 0 && (
              <span
                className="client-messages__unread-count"
                aria-label={`${unreadCount} unread conversations`}
              >
                {unreadCount}
              </span>
            )}
          </header>

          <label className="client-messages__search">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search conversations"
              aria-label="Search conversations"
            />
          </label>

          <div
            className="client-messages__conversation-list"
            aria-label="Conversations"
          >
            {conversationLoading ? (
              <div className="client-messages__list-state" role="status">
                <LoaderCircle size={17} /> Loading conversations...
              </div>
            ) : filteredConversations.length > 0 ? (
              filteredConversations.map((conversation) => {
                const person = getOtherParticipant(conversation, user?.id);
                const unread =
                  conversation.latest_message &&
                  conversation.latest_message_sender_id !== user?.id &&
                  readAtByConversation[conversation.id] !==
                    conversation.latest_message_at;

                return (
                  <button
                    type="button"
                    key={conversation.id}
                    className={`client-messages__conversation ${
                      activeConversation?.id === conversation.id
                        ? "is-active"
                        : ""
                    }`}
                    onClick={() => handleSelectConversation(conversation)}
                  >
                    <span className="client-messages__person-avatar">
                      {person.avatar ? (
                        <img src={person.avatar} alt="" />
                      ) : (
                        <CircleUserRound size={21} strokeWidth={1.5} />
                      )}
                    </span>
                    <span className="client-messages__conversation-copy">
                      <span className="client-messages__conversation-heading">
                        <strong>{person.name || "Proservora member"}</strong>
                        <time>
                          {formatConversationTime(
                            conversation.latest_message_at,
                          )}
                        </time>
                      </span>
                      <span
                        className={`client-messages__preview ${
                          unread ? "is-unread" : ""
                        }`}
                      >
                        {conversation.latest_message ||
                          "Start the conversation"}
                      </span>
                    </span>
                    {unread && <span className="client-messages__unread-dot" />}
                  </button>
                );
              })
            ) : (
              <div className="client-messages__list-empty">
                <MessageCircle size={22} strokeWidth={1.6} />
                <p>
                  {search
                    ? "No conversations match your search."
                    : "Your conversations will appear here."}
                </p>
              </div>
            )}
          </div>
        </aside>

        <section
          className="client-messages__thread"
          aria-label="Message thread"
        >
          {activeConversation && participant ? (
            <>
              <header className="client-messages__thread-header">
                <button
                  type="button"
                  className="client-messages__back"
                  onClick={() => setActiveConversation(null)}
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={18} />
                </button>
                <span className="client-messages__person-avatar client-messages__person-avatar--thread">
                  {participant.avatar ? (
                    <img src={participant.avatar} alt="" />
                  ) : (
                    <CircleUserRound size={21} strokeWidth={1.5} />
                  )}
                </span>
                <div className="client-messages__thread-person">
                  <h2>{participant.name || "Proservora member"}</h2>
                  <span>Proservora conversation</span>
                </div>
              </header>

              <div className="client-messages__message-list" aria-live="polite">
                {messagesLoading ? (
                  <div className="client-messages__thread-state" role="status">
                    <LoaderCircle size={18} /> Loading messages...
                  </div>
                ) : messages.length > 0 ? (
                  messages.map((message) => {
                    const isMine = message.sender_id === user?.id;

                    return (
                      <div
                        className={`client-messages__message-row ${
                          isMine ? "is-mine" : ""
                        }`}
                        key={message.id}
                      >
                        <div className="client-messages__message-bubble">
                          <p>{message.message}</p>
                          <span>
                            {formatMessageTime(message.created_at)}
                            {isMine && <CheckCheck size={13} />}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="client-messages__thread-state">
                    <MessageCircle size={22} strokeWidth={1.6} />
                    <p>No messages yet. Send a message to get started.</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {error && (
                <p className="client-messages__error" role="alert">
                  {error}
                </p>
              )}

              <form
                className="client-messages__composer"
                onSubmit={handleSendMessage}
              >
                <div className="client-messages__emoji-picker">
                  <button
                    type="button"
                    className="client-messages__emoji-toggle"
                    aria-label="Add emoji"
                    title="Add emoji"
                    aria-expanded={emojiOpen}
                    onClick={() => setEmojiOpen((open) => !open)}
                    disabled={sending}
                  >
                    <Smile size={19} />
                  </button>
                  {emojiOpen && (
                    <div className="client-messages__emoji-menu">
                      <EmojiPicker
                        onEmojiClick={(emojiData) => addEmoji(emojiData.emoji)}
                        emojiStyle="apple"
                        lazyLoadEmojis
                        searchPlaceholder="Search emojis"
                        width="min(352px, calc(100vw - 32px))"
                        height={360}
                      />
                    </div>
                  )}
                </div>
                <textarea
                  ref={composerRef}
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form.requestSubmit();
                    }
                  }}
                  placeholder="Write a message..."
                  aria-label="Write a message"
                  maxLength={5000}
                  rows={1}
                  disabled={sending}
                />
                <button
                  type="submit"
                  aria-label="Send message"
                  title="Send message"
                  disabled={!messageText.trim() || sending}
                >
                  {sending ? <LoaderCircle size={18} /> : <Send size={18} />}
                </button>
              </form>
            </>
          ) : (
            <div className="client-messages__welcome">
              <span className="client-messages__welcome-icon">
                <MessageCircle size={25} strokeWidth={1.5} />
              </span>
              <h2>Choose a conversation</h2>
              <p>Select someone from your inbox to read and send messages.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default Messages;
