import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MessageCircle,
  Loader2,
  Search,
  InboxIcon,
  WifiOff,
} from "lucide-react";
import { useWeb3 } from "@/contexts/web3-context";
import { getInbox, isApiConfigured, Conversation } from "@/lib/api";
import { ChatDialog } from "@/components/chat/chat-dialog";

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-green-500",
  "bg-orange-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-amber-500",
];

function avatarColor(address: string): string {
  return AVATAR_COLORS[address.charCodeAt(1) % AVATAR_COLORS.length];
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function MessagesPage() {
  const { wallet } = useWeb3();
  const myAddress = wallet.address ?? "";
  const apiOk = isApiConfigured();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const fetchInbox = useCallback(async () => {
    if (!myAddress || !apiOk) {
      setLoading(false);
      return;
    }
    try {
      const convs = await getInbox(myAddress);
      setConversations(convs);
    } catch {
      // inbox fetch failed silently; retry on next poll interval
    } finally {
      setLoading(false);
    }
  }, [myAddress, apiOk]);

  useEffect(() => {
    void fetchInbox();
    const interval = setInterval(() => void fetchInbox(), 15000);
    return () => clearInterval(interval);
  }, [fetchInbox]);

  // Refresh unread counts after closing chat
  const handleChatClose = (open: boolean) => {
    setChatOpen(open);
    if (!open) {
      setTimeout(() => void fetchInbox(), 500);
    }
  };

  const filtered = conversations.filter(
    (c) =>
      !search ||
      c.other_address.toLowerCase().includes(search.toLowerCase()),
  );

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  return (
    <div className="min-h-screen gradient-mesh py-10">
      <div className="container mx-auto px-4 max-w-2xl space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <div className="flex items-center gap-2">
              <MessageCircle className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Messages</h1>
              {totalUnread > 0 && (
                <Badge className="bg-primary text-primary-foreground h-5 min-w-5 flex items-center justify-center rounded-full text-xs px-1.5">
                  {totalUnread}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Conversations with clients and freelancers
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void fetchInbox()}>
            Refresh
          </Button>
        </motion.div>

        {/* Not connected */}
        {!myAddress && (
          <Card className="glass border-border/40">
            <CardContent className="py-16 text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-muted-foreground">
                Connect your wallet to view messages.
              </p>
            </CardContent>
          </Card>
        )}

        {/* API not configured */}
        {myAddress && !apiOk && (
          <Card className="glass border-border/40">
            <CardContent className="py-16 text-center flex flex-col items-center gap-3">
              <WifiOff className="h-12 w-12 opacity-20" />
              <p className="text-muted-foreground text-sm max-w-sm">
                Messaging requires the backend API. Configure{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  VITE_API_URL
                </code>{" "}
                to enable it.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Inbox */}
        {myAddress && apiOk && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by address…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <Card className="glass border-border/40">
                <CardContent className="py-20 flex flex-col items-center gap-3 text-muted-foreground">
                  <InboxIcon className="h-12 w-12 opacity-20" />
                  <p className="text-sm">
                    {conversations.length === 0
                      ? "No messages yet. Start a conversation from a freelancer's profile."
                      : "No conversations match your search."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filtered.map((conv, i) => {
                  const short = `${conv.other_address.slice(0, 6)}…${conv.other_address.slice(-4)}`;
                  return (
                    <motion.div
                      key={conv.conversation_id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <Card
                        className={`glass border-border/40 hover:border-primary/40 cursor-pointer transition-colors ${
                          conv.unread > 0 ? "border-primary/30 bg-primary/5" : ""
                        }`}
                        onClick={() => {
                          setActiveConv(conv);
                          setChatOpen(true);
                        }}
                      >
                        <CardContent className="p-4 flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${avatarColor(conv.other_address)}`}
                          >
                            {conv.other_address.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-sm font-semibold truncate">
                                {short}
                              </span>
                              <span className="text-[11px] text-muted-foreground shrink-0">
                                {formatRelative(conv.latest_at)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-0.5">
                              <p className="text-xs text-muted-foreground truncate">
                                {conv.latest_message}
                              </p>
                              {conv.unread > 0 && (
                                <Badge className="bg-primary text-primary-foreground h-4 min-w-4 flex items-center justify-center rounded-full text-[10px] px-1 shrink-0">
                                  {conv.unread}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Chat dialog */}
      {activeConv && (
        <ChatDialog
          open={chatOpen}
          onOpenChange={handleChatClose}
          myAddress={myAddress}
          otherAddress={activeConv.other_address}
        />
      )}
    </div>
  );
}
