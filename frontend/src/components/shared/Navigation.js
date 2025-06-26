"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  LayoutDashboard,
  Upload,
  Settings,
  Menu,
  X,
  TrendingUp,
} from "lucide-react";

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const navItems = [
    {
      href: "/",
      label: "Upload",
      icon: Upload,
      description: "Upload new invoices",
    },
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      description: "View all invoices",
    },
    {
      href: "/categories",
      label: "Categories",
      icon: Settings,
      description: "Manage categories",
    },
  ];

  const isActive = (href) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Invoice Manager
              </h1>
              <p className="text-xs text-gray-500 hidden sm:block">
                Automated Processing System
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                    ${
                      isActive(item.href)
                        ? "bg-blue-100 text-blue-700"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* System Status */}
          <div className="hidden lg:flex items-center space-x-4">
            <SystemStatus />
            <div className="text-sm text-gray-500">
              <div className="flex items-center space-x-1">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span>System Online</span>
              </div>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`
                      flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
                      ${
                        isActive(item.href)
                          ? "bg-blue-100 text-blue-700"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <div>
                      <div className="font-medium">{item.label}</div>
                      <div className="text-sm text-gray-500">
                        {item.description}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Mobile System Status */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <SystemStatus />
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

// System Status Component
function SystemStatus() {
  // In a real app, this would check API health
  const status = {
    online: true,
    apiResponseTime: "45ms",
    lastCheck: new Date(),
  };

  return (
    <div className="flex items-center space-x-2 text-sm">
      <div
        className={`w-2 h-2 rounded-full ${
          status.online ? "bg-green-500" : "bg-red-500"
        }`}
      ></div>
      <span className="text-gray-600">API: {status.apiResponseTime}</span>
    </div>
  );
}
