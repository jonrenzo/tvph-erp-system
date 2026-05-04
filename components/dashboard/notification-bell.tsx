"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  ClipboardList,
  Receipt,
  CreditCard,
  FileText,
  Building2,
  Users,
  CheckCircle2,
  X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import {
  fetchNotifications,
  markAllAsRead,
  deleteNotification,
} from "@/app/dashboard/notifications/actions";
import { NotificationType } from "@/utils/notifications";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const typeIcons = {
  po: { icon: ClipboardList, color: "text-blue-500", bg: "bg-blue-500/10" },
  invoice: { icon: Receipt, color: "text-amber-500", bg: "bg-amber-500/10" },
  payment: {
    icon: CreditCard,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  document: {
    icon: FileText,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  vendor: { icon: Building2, color: "text-teal-500", bg: "bg-teal-500/10" },
  hr: { icon: Users, color: "text-orange-500", bg: "bg-orange-500/10" },
};

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    // 1. Initial fetch
    fetchNotifications().then((data) => {
      setNotifications(data as Notification[]);
    });

    // 2. Realtime subscription
    const supabase = createClient();
    const channel = supabase
      .channel("notifications-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications((prev) => [newNotif, ...prev]);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        (payload) => {
          // Handle mark as read
          const updatedNotif = payload.new as Notification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updatedNotif.id ? updatedNotif : n)),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications" },
        (payload) => {
          setNotifications((prev) => prev.filter(n => n.id !== payload.old.id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await markAllAsRead();
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    // Optimistic delete
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await deleteNotification(id);
  };

  const handleNotificationClick = (link: string | null) => {
    if (link) {
      router.push(link);
      setIsOpen(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  return (
    <div className="relative ml-2" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-[#071F15] animate-in zoom-in">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#071F15] shadow-xl z-50 overflow-hidden flex flex-col animate-in slide-in-from-top-2 fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto max-h-[300px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="h-12 w-12 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center mb-3">
                  <Bell className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  No notifications yet
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  When there's activity, it will show up here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {notifications.map((notif) => {
                  const style = typeIcons[notif.type] || typeIcons.document;
                  const Icon = style.icon;

                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif.link)}
                      className={`group relative flex gap-3 p-4 transition-colors ${
                        notif.link
                          ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          : ""
                      } ${!notif.is_read ? "bg-primary/[0.02]" : "opacity-75"}`}
                    >
                      <div
                        className={`mt-0.5 h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${style.bg} ${style.color}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-sm font-semibold truncate ${!notif.is_read ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"}`}
                          >
                            {notif.title}
                          </p>
                          <span className="text-[10px] whitespace-nowrap text-slate-400 shrink-0 mt-0.5">
                            {formatTimeAgo(notif.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                          {notif.message}
                        </p>
                      </div>

                      {/* Read indicator */}
                      {!notif.is_read && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary shrink-0 opacity-100 group-hover:opacity-0 transition-opacity" />
                      )}

                      {/* Delete button (shows on hover) */}
                      <button
                        onClick={(e) => handleDelete(e, notif.id)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        title="Remove notification"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
