"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Apple, Home, Dumbbell, UtensilsCrossed, Droplet, Activity, UserRound, LogOut, Users2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface User {
  userId: string;
  email: string;
  name?: string;
}

interface NavigationProps {
  user?: User;
}

const communityEntryUrl =
  process.env.NEXT_PUBLIC_COMMUNITY_ENTRY_URL ||
  `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/community`;

const menuItems = [
  { name: "Home", href: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000", icon: Home, color: "text-doom-primary" },
  { name: "Dashboard", href: process.env.NEXT_PUBLIC_FITNESS_URL || "http://localhost:3005", icon: Activity, color: "text-doom-accent" },
  { name: "Physical Fitness", href: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/fitness`, icon: Dumbbell, color: "text-doom-primary" },
  { name: "Find Restaurants", href: process.env.NEXT_PUBLIC_RESTAURANTS_URL || "http://localhost:3004", icon: UtensilsCrossed, color: "text-yellow-400" },
  { name: "Skin & Hair", href: process.env.NEXT_PUBLIC_SKIN_URL || "http://localhost:3002", icon: Droplet, color: "text-blue-400" },
  { name: "Community", href: communityEntryUrl, icon: Users2, color: "text-pink-400" },
];

export function Navigation({ user }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
      await fetch(`${baseUrl}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout API failed:", error);
    } finally {
      // Clear agent profile memory
      Object.keys(localStorage).filter((k) => k.startsWith("wb_agent_profile_")).forEach((k) => localStorage.removeItem(k));
      window.location.href = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    }
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-doom-surface/95 backdrop-blur-sm border-b border-doom-primary/20">
        <div className="px-2">
          <div className="flex items-center justify-between h-16">
            <a href="/" className="flex items-center space-x-2">
              <img src="/assets/logo.jpg" alt="What Now?" className="h-9 w-auto mix-blend-screen" />
              <span className="text-xl font-bold text-doom-text hidden sm:block">What Now?</span>
            </a>

            <div className="hidden md:flex items-center space-x-6">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.name}
                    href={item.href}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-doom-bg/50 transition-colors ${item.color}`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-medium text-doom-text">{item.name}</span>
                  </a>
                );
              })}

              {user && (
                <a
                  href={`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/profile`}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-doom-bg/50 transition-colors text-doom-accent"
                >
                  <UserRound className="w-5 h-5" />
                  <span className="text-sm font-medium text-doom-text">Profile</span>
                </a>
              )}

              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors group disabled:opacity-50"
                aria-label="Logout"
              >
                <LogOut className="w-5 h-5 text-red-400 group-hover:text-red-300 transition-colors" />
                <span className="text-sm font-medium text-red-400 group-hover:text-red-300 transition-colors">
                  {isLoggingOut ? "Logging out..." : "Logout"}
                </span>
              </button>
            </div>

            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-doom-bg/50 transition-colors"
              aria-label="Toggle menu"
            >
              {isOpen ? (
                <X className="w-6 h-6 text-doom-primary" />
              ) : (
                <Menu className="w-6 h-6 text-doom-primary" />
              )}
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 z-50 w-80 max-w-[85vw] bg-doom-surface border-l border-doom-primary/20 md:hidden overflow-y-auto"
            >
              <div className="flex items-center justify-between p-6 border-b border-doom-primary/20">
                <h2 className="text-xl font-bold text-doom-text">Menu</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg hover:bg-doom-bg/50 transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-6 h-6 text-doom-primary" />
                </button>
              </div>

              <div className="p-4 space-y-2">
                {menuItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={item.name}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <a
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center space-x-4 p-4 rounded-lg hover:bg-doom-bg/50 transition-colors group ${item.color}`}
                      >
                        <div className="p-2 rounded-lg bg-doom-bg/50 group-hover:scale-110 transition-transform">
                          <Icon className="w-6 h-6" />
                        </div>
                        <span className="text-base font-medium text-doom-text">
                          {item.name}
                        </span>
                      </a>
                    </motion.div>
                  );
                })}
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-doom-primary/20">
                {user ? (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3 p-3 rounded-lg bg-doom-bg/30">
                      <UserRound className="w-5 h-5 text-doom-primary" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-doom-text">{user.name}</p>
                        <p className="text-xs text-doom-muted">{user.email}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        handleLogout();
                        setIsOpen(false);
                      }}
                      disabled={isLoggingOut}
                      className="w-full flex items-center justify-center space-x-2 p-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      <LogOut className="w-5 h-5 text-red-400" />
                      <span className="text-sm font-medium text-red-400">
                        {isLoggingOut ? "Logging out..." : "Logout"}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="text-center text-sm text-doom-muted">
                    <p>Nutrition Wellness</p>
                    <p className="text-doom-primary">Health Companion</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
