'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  Search,
  Keyboard,
  PanelLeftClose,
  Home,
  FileText,
  Users,
  Briefcase,
  Settings,
} from 'lucide-react';

interface ShortcutItem {
  keys: string[];
  description: string;
  icon?: React.ElementType;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutItem[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'General',
    shortcuts: [
      { keys: ['⌘', 'K'], description: 'Open search', icon: Search },
      { keys: ['⌘', '/'], description: 'Show keyboard shortcuts', icon: Keyboard },
      { keys: ['⌘', 'B'], description: 'Toggle sidebar', icon: PanelLeftClose },
      { keys: ['Esc'], description: 'Close dialog / Cancel' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['G', 'H'], description: 'Go to Dashboard', icon: Home },
      { keys: ['G', 'P'], description: 'Go to Projects', icon: Briefcase },
      { keys: ['G', 'C'], description: 'Go to Customers', icon: Users },
      { keys: ['G', 'I'], description: 'Go to Invoices', icon: FileText },
      { keys: ['G', 'S'], description: 'Go to Settings', icon: Settings },
    ],
  },
  {
    title: 'Search Prefixes',
    shortcuts: [
      { keys: ['cus:'], description: 'Search customers' },
      { keys: ['prj:'], description: 'Search projects' },
      { keys: ['inv:'], description: 'Search invoices' },
      { keys: ['emp:'], description: 'Search employees' },
      { keys: ['ven:'], description: 'Search vendors' },
      { keys: ['itm:'], description: 'Search items' },
    ],
  },
];

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function KeyBadge({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-gray-300">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsModal({ open, onOpenChange }: KeyboardShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-100">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut, index) => {
                  const Icon = shortcut.icon;
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-800/50"
                    >
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        {Icon && <Icon className="h-4 w-4 text-gray-500" />}
                        <span>{shortcut.description}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIndex) => (
                          <React.Fragment key={keyIndex}>
                            <KeyBadge>{key}</KeyBadge>
                            {keyIndex < shortcut.keys.length - 1 && (
                              <span className="text-gray-600 text-xs">+</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-800">
          <p className="text-xs text-gray-500 text-center">
            Press <KeyBadge>⌘</KeyBadge> <span className="text-gray-600">+</span> <KeyBadge>/</KeyBadge> anytime to show this dialog
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default KeyboardShortcutsModal;
