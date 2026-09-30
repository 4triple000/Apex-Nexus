import { useState, useRef, useEffect } from "react";
import { Bell, Heart, UserPlus, GitFork } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications, useMarkNotificationsRead } from "@/hooks/useSocial";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  like: <Heart size={13} className="text-red-400 fill-red-400" />,
  follow: <UserPlus size={13} className="text-blue-400" />,
  remix: <GitFork size={13} className="text-purple-400" />,
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useNotifications();
  const markRead = useMarkNotificationsRead();

  const unread = data?.unreadCount ?? 0;
  const notifications = data?.notifications ?? [];

  function handleOpen() {
    setOpen((v) => !v);
    if (!open && unread > 0) {
      setTimeout(() => markRead.mutate(), 1500);
    }
  }

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10 transition-colors"
      >
        <Bell size={18} className={cn("transition-colors", open ? "text-[#A29BFE]" : "text-white/60")} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-72 max-h-80 bg-[rgba(30,26,62,0.62)] border border-white/10 rounded-2xl shadow-2xl overflow-y-auto z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="text-sm font-bold text-white">Notifications</span>
            {unread > 0 && <span className="text-xs text-white/40">{unread} new</span>}
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-white/30 text-sm">No notifications yet</div>
          ) : (
            <div className="divide-y divide-white/5">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 transition-colors",
                    !n.read && "bg-white/[0.03]"
                  )}
                >
                  <div className="mt-0.5 flex-shrink-0">{TYPE_ICONS[n.type] ?? <Bell size={13} className="text-white/40" />}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/80 leading-snug">{n.message}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-[#A29BFE] flex-shrink-0 mt-1" />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
