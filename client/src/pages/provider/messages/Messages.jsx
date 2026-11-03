import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCheck, CircleUserRound, LoaderCircle, MessageCircle, Search, Send, Smile } from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "../../../context/AuthContext";
import { getConversationMessages, getMyConversations, markConversationAsRead, sendChatMessage } from "../../../services/chatService";
import "../../client/messages/Messages.css";

const getClient = (conversation) => ({
  name: [conversation.customer_first_name, conversation.customer_last_name].filter(Boolean).join(" "),
  avatar: conversation.customer_avatar_url,
});

const conversationTime = (value) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return "";
  const date = new Date(value);
  if (date.toDateString() === new Date().toDateString()) {
    return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(date);
  }
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(date);
};

const messageTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(date);
};

function Messages() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingThread, setLoadingThread] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [messageText, setMessageText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [error, setError] = useState("");
  const [readAt, setReadAt] = useState({});
  const endRef = useRef(null);
  const composerRef = useRef(null);
  const requestedId = searchParams.get("conversationId");

  useEffect(() => {
    let current = true;
    const load = async (initial = false) => {
      try {
        const response = await getMyConversations();
        if (!current) return;
        const items = response?.conversations || [];
        setConversations(items);
        if (initial) {
          const requested = items.find(({ id }) => String(id) === requestedId);
          setActiveConversation((selected) => requested || selected || items[0] || null);
        }
      } catch (loadError) {
        if (current && initial) setError(loadError.response?.data?.message || "Unable to load client conversations.");
      } finally {
        if (current && initial) setLoadingInbox(false);
      }
    };
    load(true);
    const interval = window.setInterval(() => load(), 15000);
    return () => { current = false; window.clearInterval(interval); };
  }, [requestedId]);

  useEffect(() => {
    if (!activeConversation?.id) return undefined;
    let current = true;
    const load = async () => {
      try {
        const response = await getConversationMessages(activeConversation.id);
        if (!current) return;
        const items = response?.messages || [];
        setMessages(items);
        await markConversationAsRead(activeConversation.id);
        if (current) setReadAt((previous) => ({ ...previous, [activeConversation.id]: items.at(-1)?.created_at || activeConversation.latest_message_at }));
      } catch (loadError) {
        if (current) setError(loadError.response?.data?.message || "Unable to load this conversation.");
      } finally {
        if (current) setLoadingThread(false);
      }
    };
    load();
    const interval = window.setInterval(load, 8000);
    return () => { current = false; window.clearInterval(interval); };
  }, [activeConversation]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const isUnread = (conversation) => Boolean(conversation.latest_message && conversation.latest_message_sender_id !== user?.id && readAt[conversation.id] !== conversation.latest_message_at);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? conversations.filter((item) => getClient(item).name.toLowerCase().includes(query)) : conversations;
  }, [conversations, search]);
  const client = activeConversation ? getClient(activeConversation) : null;

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

  const handleSend = async (event) => {
    event.preventDefault();
    const text = messageText.trim();
    if (!text || !activeConversation || sending) return;
    setSending(true); setError("");
    try {
      const response = await sendChatMessage(activeConversation.id, text);
      const newMessage = response?.data;
      if (newMessage) {
        setMessages((previous) => [...previous, newMessage]);
        setConversations((previous) => previous.map((item) => item.id === activeConversation.id ? { ...item, latest_message: newMessage.message, latest_message_at: newMessage.created_at, latest_message_sender_id: user?.id } : item).sort((a, b) => new Date(b.latest_message_at || b.created_at) - new Date(a.latest_message_at || a.created_at)));
        setReadAt((previous) => ({ ...previous, [activeConversation.id]: newMessage.created_at }));
      }
      setMessageText("");
    } catch (sendError) {
      setError(sendError.response?.data?.message || "Unable to send your reply. Please try again.");
    } finally { setSending(false); }
  };

  return <div className="client-messages provider-messages">
    <header className="client-messages__page-header"><span className="client-messages__eyebrow">PROVIDER WORKSPACE</span><h1>Messages</h1><p>Reply to client enquiries and keep every service conversation moving.</p></header>
    <div className={`client-messages__workspace ${activeConversation ? "client-messages__workspace--open" : ""}`}>
      <aside className="client-messages__inbox">
        <header className="client-messages__inbox-header"><h2>Client conversations</h2>{conversations.filter(isUnread).length > 0 && <span className="client-messages__unread-count" aria-label={`${conversations.filter(isUnread).length} unread conversations`}>{conversations.filter(isUnread).length}</span>}</header>
        <label className="client-messages__search"><Search size={17} aria-hidden="true" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clients" aria-label="Search client conversations" /></label>
        <div className="client-messages__conversation-list" aria-label="Client conversations">
          {loadingInbox ? <div className="client-messages__list-state" role="status"><LoaderCircle size={17} /> Loading conversations...</div> : filtered.length ? filtered.map((conversation) => {
            const person = getClient(conversation); const unread = isUnread(conversation);
            return <button type="button" key={conversation.id} className={`client-messages__conversation ${activeConversation?.id === conversation.id ? "is-active" : ""}`} onClick={() => { setError(""); setMessages([]); setLoadingThread(true); setActiveConversation(conversation); }}><span className="client-messages__person-avatar">{person.avatar ? <img src={person.avatar} alt="" /> : <CircleUserRound size={21} strokeWidth={1.5} />}</span><span className="client-messages__conversation-copy"><span className="client-messages__conversation-heading"><strong>{person.name || "Client"}</strong><time>{conversationTime(conversation.latest_message_at)}</time></span><span className={`client-messages__preview ${unread ? "is-unread" : ""}`}>{conversation.latest_message || "No messages yet"}</span></span>{unread && <span className="client-messages__unread-dot" />}</button>;
          }) : <div className="client-messages__list-empty"><MessageCircle size={22} strokeWidth={1.6} /><p>{search ? "No client conversations match your search." : "Client conversations will appear here once they contact you."}</p></div>}
        </div>
      </aside>
      <section className="client-messages__thread" aria-label="Client message thread">
        {activeConversation && client ? <>
          <header className="client-messages__thread-header"><button type="button" className="client-messages__back" onClick={() => setActiveConversation(null)} aria-label="Back to client conversations"><ArrowLeft size={18} /></button><span className="client-messages__person-avatar client-messages__person-avatar--thread">{client.avatar ? <img src={client.avatar} alt="" /> : <CircleUserRound size={21} strokeWidth={1.5} />}</span><div className="client-messages__thread-person"><h2>{client.name || "Client"}</h2><span>Client conversation</span></div></header>
          <div className="client-messages__message-list" aria-live="polite">{loadingThread ? <div className="client-messages__thread-state" role="status"><LoaderCircle size={18} /> Loading messages...</div> : messages.length ? messages.map((message) => { const mine = message.sender_id === user?.id; return <div className={`client-messages__message-row ${mine ? "is-mine" : ""}`} key={message.id}><div className="client-messages__message-bubble"><p>{message.message}</p><span>{messageTime(message.created_at)}{mine && <CheckCheck size={13} />}</span></div></div>; }) : <div className="client-messages__thread-state"><MessageCircle size={22} strokeWidth={1.6} /><p>No messages yet. Send a reply to start the conversation.</p></div>}<div ref={endRef} /></div>
          {error && <p className="client-messages__error" role="alert">{error}</p>}
          <form className="client-messages__composer" onSubmit={handleSend}><div className="client-messages__emoji-picker"><button type="button" className="client-messages__emoji-toggle" aria-label="Add emoji" title="Add emoji" aria-expanded={emojiOpen} onClick={() => setEmojiOpen((open) => !open)} disabled={sending}><Smile size={19} /></button>{emojiOpen && <div className="client-messages__emoji-menu"><EmojiPicker onEmojiClick={(emojiData) => addEmoji(emojiData.emoji)} emojiStyle="apple" lazyLoadEmojis searchPlaceholder="Search emojis" width="min(352px, calc(100vw - 32px))" height={360} /></div>}</div><textarea ref={composerRef} value={messageText} onChange={(event) => setMessageText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form.requestSubmit(); } }} placeholder="Write a reply..." aria-label="Write a reply" maxLength={5000} rows={1} disabled={sending} /><button type="submit" aria-label="Send reply" title="Send reply" disabled={!messageText.trim() || sending}>{sending ? <LoaderCircle size={18} /> : <Send size={18} />}</button></form>
        </> : <div className="client-messages__welcome"><span className="client-messages__welcome-icon"><MessageCircle size={25} strokeWidth={1.5} /></span><h2>Choose a client conversation</h2><p>Select a client from your inbox to review their message and reply.</p></div>}
      </section>
    </div>
  </div>;
}

export default Messages;
