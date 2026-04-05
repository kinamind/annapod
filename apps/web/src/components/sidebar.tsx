"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  BookOpen,
  TrendingUp,
  Eye,
  User,
  LayoutDashboard,
  LogOut,
  Menu,
  Sun,
  Moon,
  Languages,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuthStore } from "@/lib/store";
import { useLocale } from "@/lib/locale";
import { useState } from "react";
import { useTheme } from "next-themes";

const navItems = [
  {
    titleKey: "nav.dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    titleKey: "nav.simulator",
    href: "/simulator",
    icon: MessageSquare,
    descKey: "nav.simulator.desc",
  },
  {
    titleKey: "nav.knowledge",
    href: "/knowledge",
    icon: BookOpen,
    descKey: "nav.knowledge.desc",
  },
  {
    titleKey: "nav.learning",
    href: "/learning",
    icon: TrendingUp,
    descKey: "nav.learning.desc",
  },
  {
    titleKey: "nav.preview",
    href: "/preview",
    icon: Eye,
    descKey: "nav.preview.desc",
    disabled: true,
  },
  {
    titleKey: "nav.profile",
    href: "/profile",
    icon: User,
  },
];

function NavContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useLocale();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
          安
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{t("app.name")}</span>
          <span className="text-[10px] text-muted-foreground">{t("app.subtitle")}</span>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.disabled ? "#" : item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                item.disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <div className="flex flex-col">
                <span>{t(item.titleKey)}</span>
                {item.descKey && (
                  <span className="text-[10px] text-muted-foreground">
                    {t(item.descKey)}
                  </span>
                )}
              </div>
              {item.disabled && (
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px]">
                  {t("nav.soon")}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Theme & Language Controls */}
      <div className="border-t px-3 py-2 space-y-1">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start gap-2 h-8 text-xs"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {theme === "dark" ? t("theme.light") : t("theme.dark")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start gap-2 h-8 text-xs"
            onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
          >
            <Languages className="h-3.5 w-3.5" />
            {locale === "zh" ? "English" : "中文"}
          </Button>
        </div>
      </div>

      {/* User Footer */}
      <div className="border-t p-3">
        {user && (
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
              {user.display_name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.display_name}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {user.experience_level}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => {
                logout();
                window.location.href = "/login";
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:border-r bg-card h-screen sticky top-0">
      <NavContent />
    </aside>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex lg:hidden items-center h-14 border-b px-4 bg-card">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 w-9 hover:bg-accent hover:text-accent-foreground"
        >
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-60 p-0">
          <NavContent onClose={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex items-center gap-2 ml-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
          安
        </div>
        <span className="text-sm font-semibold">annapod</span>
      </div>
    </div>
  );
}
