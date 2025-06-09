'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton, useUser, OrganizationSwitcher } from '@clerk/nextjs';
import {
  Home as HomeIcon,
  Briefcase as BriefcaseIcon,
  FileText as FileTextIcon,
  Settings as SettingsIcon,
  Users as UsersIconComponent,
  LogOut as LogOutIcon,
  Building as BuildingIcon,
  AppWindow as AppWindowIcon,
  Ticket as TicketIcon,
  Shield as ShieldIcon,
  ListChecks as ListChecksIcon,
  ArrowRightLeft as ArrowRightLeftIcon,
  Settings2 as Settings2Icon,
  ChevronDown as ChevronDownIcon,
  ChevronRight as ChevronRightIcon,
  WalletCards as WalletCardsIcon,
  LibraryBig as LibraryBigIcon,
  Network as NetworkIcon,
  MapPinned as MapPinnedIcon,
  ListOrdered as ListOrderedIcon,
  Users as UsersIcon,
  Package as PackageIcon,
  Ruler as RulerIcon,
  Tags as TagsIcon
} from 'lucide-react';

const NewPageSidebar = () => {
  const pathname = usePathname();
  const { user } = useUser();

  const [isListsOpen, setIsListsOpen] = useState(false);
  const [isAccountingOpen, setIsAccountingOpen] = useState(false);
  const [isRelationshipsOpen, setIsRelationshipsOpen] = useState(false);
  const [isItemsOpen, setIsItemsOpen] = useState(false);
  const [isTransactionsOpen, setIsTransactionsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const isActive = (itemPath: string) => {
    if (itemPath === '/') return pathname === itemPath;
    return pathname === itemPath || pathname.startsWith(itemPath + '/');
  };
  
  const activeLinkClass = 'bg-gray-700 text-white';
  const inactiveLinkClass = 'hover:bg-gray-700/50 hover:text-white';
  const baseLinkClass = 'flex items-center space-x-3 px-3 py-2.5 rounded-md text-sm font-medium';
  const baseSubLinkClass = 'flex items-center space-x-3 pl-10 pr-3 py-2 rounded-md text-sm font-medium';

  const iconSize = 18;
  const iconClasses = 'h-4 w-4 opacity-75';

  return (
    <aside className="w-72 bg-gray-900 text-gray-100 flex flex-col h-screen">
      {/* Header / Logo */}
      <div className="p-6 border-b border-gray-700 flex items-center space-x-3">
        {/* @ts-ignore */}
        <ShieldIcon className="h-8 w-8 text-white" /> 
        <span className="text-2xl font-semibold text-white">GLAPI</span>
      </div>

      {/* Organization Switcher */}
      <div className="p-4 border-b border-gray-700">
        <OrganizationSwitcher
          afterCreateOrganizationUrl="/dashboard"
          afterSelectOrganizationUrl="/dashboard"
          // hidePersonal={true} // Optional: Uncomment if you want to hide personal workspace
          appearance={{
            // Rely on global baseTheme: dark from ClerkProvider
            // Override specific elements for finer control if needed:
            elements: {
              organizationSwitcherTrigger:
                'w-full flex items-center justify-between p-3 rounded-md bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-sky-500 text-sm font-medium text-gray-100 border border-transparent',
              organizationSwitcherPopoverCard: 
                'bg-gray-800 border-gray-700 text-gray-100 shadow-xl',
              organizationSwitcherPopoverActionButton: 
                'text-gray-200 hover:bg-gray-700 px-3 py-2 rounded-md',
              organizationSwitcherPreviewButton: 
                'text-gray-200 hover:bg-gray-700 px-3 py-2 rounded-md',
              organizationSwitcherCreateOrganizationButton: 
                'text-gray-200 hover:bg-gray-700 px-3 py-2 rounded-md',
              organizationPreviewTextContainer: 'text-gray-200',
              organizationPreviewMainIdentifier: 'text-gray-100 font-medium',
              organizationSwitcherErrorText: 'text-red-400 text-xs',
              // You can style other elements like 'userPreviewSecondaryIdentifier', 'organizationSwitcherListedItems', etc.
            },
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <div>
          <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Main</h3>
          <ul className="space-y-1">
            <li>
              {/* @ts-ignore */}
              <Link href="/dashboard"
                    className={`${baseLinkClass} ${isActive('/dashboard') ? activeLinkClass : inactiveLinkClass}`}>
                {/* @ts-ignore */}
                <HomeIcon className="h-5 w-5" />
                <span>Dashboard</span>
              </Link>
            </li>
            <li>
              {/* @ts-ignore */}
              <Link href="/organizations" 
                    className={`${baseLinkClass} ${isActive('/organizations') ? activeLinkClass : inactiveLinkClass}`}>
                {/* @ts-ignore */}
                <BriefcaseIcon className="h-5 w-5" />
                <span>Organizations</span>
              </Link>
            </li>
            <li>
              {/* @ts-ignore */}
              <Link href="/reports" 
                    className={`${baseLinkClass} ${isActive('/reports') ? activeLinkClass : inactiveLinkClass}`}>
                {/* @ts-ignore */}
                <FileTextIcon className="h-5 w-5" />
                <span>Reports</span>
              </Link>
            </li>
          </ul>
        </div>

        {/* Lists Section (Expandable) */}
        <div>
          <button 
            onClick={() => setIsListsOpen(!isListsOpen)}
            className={`${baseLinkClass} w-full justify-between text-gray-300 hover:text-white hover:bg-gray-700/50`}
          >
            <div className="flex items-center space-x-3">
              {/* @ts-ignore */}
              <ListChecksIcon className="h-5 w-5" />
              <span>Lists</span>
            </div>
            {/* @ts-ignore */}
            {isListsOpen ? <ChevronDownIcon className="h-5 w-5" /> : <ChevronRightIcon className="h-5 w-5" />}
          </button>
          {isListsOpen && (
            <div className="mt-1 space-y-1">
              {/* Accounting Section */}
              <div>
                <button 
                  onClick={() => setIsAccountingOpen(!isAccountingOpen)}
                  className={`${baseSubLinkClass} w-full justify-between text-gray-300 hover:text-white hover:bg-gray-700/50`}
                >
                  <div className="flex items-center space-x-3">
                    {/* @ts-ignore */}
                    <WalletCardsIcon className="h-4 w-4" />
                    <span>Accounting</span>
                  </div>
                  {/* @ts-ignore */}
                  {isAccountingOpen ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                </button>
                {isAccountingOpen && (
                  <ul className="mt-1 space-y-1">
                    <li>
                      {/* @ts-ignore */}
                      <Link href="/lists/accounts" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/lists/accounts') ? activeLinkClass : inactiveLinkClass}`}>
                        {/* @ts-ignore */}
                        <ListOrderedIcon className={`h-3 w-3 opacity-75`} />
                        <span>Accounts</span>
                      </Link>
                    </li>
                    <li>
                      {/* @ts-ignore */}
                      <Link href="/lists/classes" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/lists/classes') ? activeLinkClass : inactiveLinkClass}`}>
                        {/* @ts-ignore */}
                        <LibraryBigIcon className={`h-3 w-3 opacity-75`} />
                        <span>Classes</span>
                      </Link>
                    </li>
                    <li>
                      {/* @ts-ignore */}
                      <Link href="/lists/departments" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/lists/departments') ? activeLinkClass : inactiveLinkClass}`}>
                        {/* @ts-ignore */}
                        <NetworkIcon className={`h-3 w-3 opacity-75`} />
                        <span>Departments</span>
                      </Link>
                    </li>
                    <li>
                      {/* @ts-ignore */}
                      <Link href="/lists/locations" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/lists/locations') ? activeLinkClass : inactiveLinkClass}`}>
                        {/* @ts-ignore */}
                        <MapPinnedIcon className={`h-3 w-3 opacity-75`} />
                        <span>Locations</span>
                      </Link>
                    </li>
                    <li>
                      {/* @ts-ignore */}
                      <Link href="/lists/subsidiaries" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/lists/subsidiaries') ? activeLinkClass : inactiveLinkClass}`}>
                        {/* @ts-ignore */}
                        <BuildingIcon className={`h-3 w-3 opacity-75`} />
                        <span>Subsidiaries</span>
                      </Link>
                    </li>
                  </ul>
                )}
              </div>
              
              {/* Relationships Section */}
              <div>
                <button 
                  onClick={() => setIsRelationshipsOpen(!isRelationshipsOpen)}
                  className={`${baseSubLinkClass} w-full justify-between text-gray-300 hover:text-white hover:bg-gray-700/50`}
                >
                  <div className="flex items-center space-x-3">
                    {/* @ts-ignore */}
                    <UsersIcon className="h-4 w-4" />
                    <span>Relationships</span>
                  </div>
                  {/* @ts-ignore */}
                  {isRelationshipsOpen ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                </button>
                {isRelationshipsOpen && (
                  <ul className="mt-1 space-y-1">
                    <li>
                      {/* @ts-ignore */}
                      <Link href="/relationships/customers" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/relationships/customers') ? activeLinkClass : inactiveLinkClass}`}>
                        {/* @ts-ignore */}
                        <UsersIcon className={`h-3 w-3 opacity-75`} />
                        <span>Customers</span>
                      </Link>
                    </li>
                    <li>
                      {/* @ts-ignore */}
                      <Link href="/relationships/vendors" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/relationships/vendors') ? activeLinkClass : inactiveLinkClass}`}>
                        {/* @ts-ignore */}
                        <BriefcaseIcon className={`h-3 w-3 opacity-75`} />
                        <span>Vendors</span>
                      </Link>
                    </li>
                    <li>
                      {/* @ts-ignore */}
                      <Link href="/relationships/employees" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/relationships/employees') ? activeLinkClass : inactiveLinkClass}`}>
                        {/* @ts-ignore */}
                        <UsersIconComponent className={`h-3 w-3 opacity-75`} />
                        <span>Employees</span>
                      </Link>
                    </li>
                    <li>
                      {/* @ts-ignore */}
                      <Link href="/relationships/leads" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/relationships/leads') ? activeLinkClass : inactiveLinkClass}`}>
                        {/* @ts-ignore */}
                        <TicketIcon className={`h-3 w-3 opacity-75`} />
                        <span>Leads</span>
                      </Link>
                    </li>
                    <li>
                      {/* @ts-ignore */}
                      <Link href="/relationships/prospects" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/relationships/prospects') ? activeLinkClass : inactiveLinkClass}`}>
                        {/* @ts-ignore */}
                        <ShieldIcon className={`h-3 w-3 opacity-75`} />
                        <span>Prospects</span>
                      </Link>
                    </li>
                    <li>
                      {/* @ts-ignore */}
                      <Link href="/relationships/contacts" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/relationships/contacts') ? activeLinkClass : inactiveLinkClass}`}>
                        {/* @ts-ignore */}
                        <UsersIcon className={`h-3 w-3 opacity-75`} />
                        <span>Contacts</span>
                      </Link>
                    </li>
                  </ul>
                )}
              </div>
              
              {/* Items Section */}
              <div>
                <button 
                  onClick={() => setIsItemsOpen(!isItemsOpen)}
                  className={`${baseSubLinkClass} w-full justify-between text-gray-300 hover:text-white hover:bg-gray-700/50`}
                >
                  <div className="flex items-center space-x-3">
                    {/* @ts-ignore */}
                    <PackageIcon className="h-4 w-4" />
                    <span>Items</span>
                  </div>
                  {/* @ts-ignore */}
                  {isItemsOpen ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                </button>
                {isItemsOpen && (
                  <ul className="mt-1 space-y-1">
                    <li>
                      {/* @ts-ignore */}
                      <Link href="/lists/units-of-measure" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/lists/units-of-measure') ? activeLinkClass : inactiveLinkClass}`}>
                        {/* @ts-ignore */}
                        <RulerIcon className={`h-3 w-3 opacity-75`} />
                        <span>Units of Measure</span>
                      </Link>
                    </li>
                    <li>
                      {/* @ts-ignore */}
                      <Link href="/lists/item-categories" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/lists/item-categories') ? activeLinkClass : inactiveLinkClass}`}>
                        {/* @ts-ignore */}
                        <TagsIcon className={`h-3 w-3 opacity-75`} />
                        <span>Categories</span>
                      </Link>
                    </li>
                    <li>
                      {/* @ts-ignore */}
                      <Link href="/lists/items" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/lists/items') ? activeLinkClass : inactiveLinkClass}`}>
                        {/* @ts-ignore */}
                        <PackageIcon className={`h-3 w-3 opacity-75`} />
                        <span>Items</span>
                      </Link>
                    </li>
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Settings Section (Expandable) - NEW TOP LEVEL */}
        <div>
          <button 
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`${baseLinkClass} w-full justify-between text-gray-300 hover:text-white hover:bg-gray-700/50`}
          >
            <div className="flex items-center space-x-3">
              {/* @ts-ignore */}
              <Settings2Icon className="h-5 w-5" />
              <span>Settings</span>
            </div>
            {/* @ts-ignore */}
            {isSettingsOpen ? <ChevronDownIcon className="h-5 w-5" /> : <ChevronRightIcon className="h-5 w-5" />}
          </button>
          {isSettingsOpen && (
            <ul className="mt-1 space-y-1">
              {/* Placeholder for future settings sub-items */}
               <li><span className={`${baseSubLinkClass} text-gray-400`}>Sub-item 1</span></li>
               <li><span className={`${baseSubLinkClass} text-gray-400`}>Sub-item 2</span></li>
            </ul>
          )}
        </div>

        {/* Transactions Section (Expandable) */}
        <div>
          <button 
            onClick={() => setIsTransactionsOpen(!isTransactionsOpen)}
            className={`${baseLinkClass} w-full justify-between text-gray-300 hover:text-white hover:bg-gray-700/50`}
          >
            <div className="flex items-center space-x-3">
              {/* @ts-ignore */}
              <ArrowRightLeftIcon className="h-5 w-5" />
              <span>Transactions</span>
            </div>
            {/* @ts-ignore */}
            {isTransactionsOpen ? <ChevronDownIcon className="h-5 w-5" /> : <ChevronRightIcon className="h-5 w-5" />}
          </button>
          {isTransactionsOpen && (
            <ul className="mt-1 space-y-1">
              {/* Placeholder for future transaction sub-items */}
              <li><span className={`${baseSubLinkClass} text-gray-400`}>Sub-item A</span></li>
              <li><span className={`${baseSubLinkClass} text-gray-400`}>Sub-item B</span></li>
            </ul>
          )}
        </div>

        {/* Account Section - Kept as is */}
        <div>
          <h3 className="px-3 mb-2 mt-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Account</h3>
          <ul className="space-y-1">
            <li>
              {/* @ts-ignore */}
              <Link href="/apps" 
                    className={`${baseLinkClass} ${isActive('/apps') ? activeLinkClass : inactiveLinkClass}`}>
                {/* @ts-ignore */}
                <AppWindowIcon className="h-5 w-5" />
                <span>Apps</span>
              </Link>
            </li>
            <li>
              {/* @ts-ignore */}
              <Link href="/settings" 
                    className={`${baseLinkClass} ${isActive('/settings') ? activeLinkClass : inactiveLinkClass}`}>
                {/* @ts-ignore */}
                <SettingsIcon className="h-5 w-5" /> 
                <span>User Settings</span>
              </Link>
            </li>
             <li>
              {/* @ts-ignore */}
              <Link href="/account" 
                    className={`${baseLinkClass} ${isActive('/account') ? activeLinkClass : inactiveLinkClass}`}>
                {/* @ts-ignore */}
                <UsersIconComponent className="h-5 w-5" /> 
                <span>Profile</span>
              </Link>
            </li>
            <li>
              {/* @ts-ignore */}
              <Link href="/tickets" 
                    className={`${baseLinkClass} ${isActive('/tickets') ? activeLinkClass : inactiveLinkClass}`}>
                {/* @ts-ignore */}
                <TicketIcon className="h-5 w-5" />
                <span>Tickets</span>
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      {/* Footer / UserButton (Clerk) */}
      <div className="p-4 border-t border-gray-700 mt-auto">
        {user && (
          <div className="flex items-center space-x-3">
            <UserButton afterSignOutUrl="/" />
            <div className="text-sm">
              <p className="font-medium text-white">{user.fullName || user.primaryEmailAddress?.emailAddress}</p>
            </div>
          </div>
        )}
        {!user && (
          /* @ts-ignore */
           <Link href="/sign-in"
                    className={`flex items-center space-x-3 px-3 py-2.5 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700/50 hover:text-white focus:outline-none focus:bg-gray-700/50`}>
                {/* @ts-ignore */}
                <LogOutIcon className="h-5 w-5" /> 
                <span>Sign In</span>
            </Link>
        )}
      </div>
    </aside>
  );
};

export default NewPageSidebar; 