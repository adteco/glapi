'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton, useUser, useAuth, OrganizationSwitcher } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';
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
  Tags as TagsIcon,
  Building2 as Building2Icon,
  BookOpen as BookOpenIcon,
  ShoppingCart as ShoppingCartIcon,
  FileBarChart as FileBarChartIcon,
  Target as TargetIcon,
  Truck as TruckIcon,
  Warehouse as WarehouseIcon,
  Calendar as CalendarIcon,
  DollarSign as DollarSignIcon,
  MessageCircle as MessageCircleIcon,
  HardHat as HardHatIcon,
  ClipboardList as ClipboardListIcon,
  Receipt as ReceiptIcon,
  Clock as ClockIcon,
  CreditCard as CreditCardIcon,
  Zap as ZapIcon,
  PanelLeftClose as PanelLeftCloseIcon,
  PanelLeft as PanelLeftIcon,
  Workflow as WorkflowIcon,
  Plus as PlusIcon,
  Circle as CircleIcon,
  Loader2 as Loader2Icon,
  FolderOpen as FolderOpenIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';

interface NewPageSidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

// Icon mapping for workflow components
const iconMap: Record<string, React.ElementType> = {
  users: UsersIcon,
  briefcase: BriefcaseIcon,
  'file-text': FileTextIcon,
  settings: SettingsIcon,
  building: BuildingIcon,
  ticket: TicketIcon,
  shield: ShieldIcon,
  'list-checks': ListChecksIcon,
  'arrow-right-left': ArrowRightLeftIcon,
  settings2: Settings2Icon,
  'wallet-cards': WalletCardsIcon,
  'library-big': LibraryBigIcon,
  network: NetworkIcon,
  'map-pinned': MapPinnedIcon,
  'list-ordered': ListOrderedIcon,
  package: PackageIcon,
  ruler: RulerIcon,
  tags: TagsIcon,
  building2: Building2Icon,
  'book-open': BookOpenIcon,
  'shopping-cart': ShoppingCartIcon,
  'file-bar-chart': FileBarChartIcon,
  target: TargetIcon,
  truck: TruckIcon,
  warehouse: WarehouseIcon,
  calendar: CalendarIcon,
  'dollar-sign': DollarSignIcon,
  'message-circle': MessageCircleIcon,
  'hard-hat': HardHatIcon,
  'clipboard-list': ClipboardListIcon,
  receipt: ReceiptIcon,
  clock: ClockIcon,
  'credit-card': CreditCardIcon,
  zap: ZapIcon,
  home: HomeIcon,
  workflow: WorkflowIcon,
  'folder-open': FolderOpenIcon,
};

// Helper function to get icon component by name
const getIconComponent = (iconName: string | null | undefined): React.ElementType => {
  if (!iconName) return CircleIcon;
  const normalizedName = iconName.toLowerCase().replace(/icon$/i, '').replace(/_/g, '-');
  return iconMap[normalizedName] || CircleIcon;
};

const NewPageSidebar = ({ collapsed = false, onToggleCollapse, isMobileOpen = false, onMobileOpenChange }: NewPageSidebarProps) => {
  const pathname = usePathname();
  const { user } = useUser();
  const { orgId } = useAuth();

  // Close mobile menu on route change
  useEffect(() => {
    if (isMobileOpen && onMobileOpenChange) {
      onMobileOpenChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Fetch workflows with caching (5 minutes stale time)
  const { data: workflowsData, isLoading: isLoadingWorkflows } = trpc.workflows.list.useQuery(
    {},
    {
      enabled: !!orgId,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    }
  );

  // State for workflow section expansion
  const [isWorkflowsSectionOpen, setIsWorkflowsSectionOpen] = useState(false);
  const [openWorkflows, setOpenWorkflows] = useState<Record<string, boolean>>({});
  const [openWorkflowGroups, setOpenWorkflowGroups] = useState<Record<string, boolean>>({});

  // Toggle individual workflow open/close
  const toggleWorkflow = (workflowId: string) => {
    setOpenWorkflows(prev => ({ ...prev, [workflowId]: !prev[workflowId] }));
  };

  // Toggle workflow group open/close
  const toggleWorkflowGroup = (groupId: string) => {
    setOpenWorkflowGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Organize components by group for each workflow
  const organizedWorkflows = useMemo(() => {
    if (!workflowsData) return [];

    return workflowsData.map(workflow => {
      const groupMap = new Map<string | null, typeof workflow.components>();

      // Initialize groups
      workflow.groups.forEach(group => {
        groupMap.set(group.id, []);
      });
      groupMap.set(null, []); // For ungrouped components

      // Assign components to groups
      workflow.components
        .filter(c => c.isEnabled)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .forEach(component => {
          const groupComponents = groupMap.get(component.groupId) || [];
          groupComponents.push(component);
          groupMap.set(component.groupId, groupComponents);
        });

      return {
        ...workflow,
        groupedComponents: groupMap,
      };
    });
  }, [workflowsData]);

  const [isListsOpen, setIsListsOpen] = useState(false);
  const [isAccountingOpen, setIsAccountingOpen] = useState(false);
  const [isRelationshipsOpen, setIsRelationshipsOpen] = useState(false);
  const [isItemsOpen, setIsItemsOpen] = useState(false);
  const [isTransactionsOpen, setIsTransactionsOpen] = useState(false);
  const [isTransactionManagementOpen, setIsTransactionManagementOpen] = useState(false);
  const [isTransactionSalesOpen, setIsTransactionSalesOpen] = useState(false);
  const [isTransactionInventoryOpen, setIsTransactionInventoryOpen] = useState(false);
  const [isTransactionRecurringOpen, setIsTransactionRecurringOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const isActive = (itemPath: string) => {
    if (itemPath === '/') return pathname === itemPath;
    return pathname === itemPath || pathname.startsWith(itemPath + '/');
  };
  
  const activeLinkClass = 'bg-sidebar-primary text-sidebar-primary-foreground';
  const inactiveLinkClass = 'hover:bg-sidebar-hover hover:text-sidebar-foreground';
  const baseLinkClass = 'flex items-center space-x-3 px-3 py-2.5 rounded-md text-sm font-medium';
  const baseSubLinkClass = 'flex items-center space-x-3 pl-10 pr-3 py-2 rounded-md text-sm font-medium';

  const iconSize = 18;
  const iconClasses = 'h-4 w-4 opacity-75';

  // Collapsed link wrapper with tooltip
  const CollapsedLinkWrapper = ({ href, icon: Icon, label, isItemActive, isCollapsed }: { href: string; icon: React.ElementType; label: string; isItemActive: boolean; isCollapsed?: boolean }) => {
    // Use passed isCollapsed prop, fallback to component's collapsed state
    const effectiveCollapsed = isCollapsed ?? collapsed;
    if (effectiveCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={href}
              className={cn(
                'flex items-center justify-center p-2.5 rounded-md',
                isItemActive ? activeLinkClass : inactiveLinkClass
              )}
            >
              <Icon className="h-5 w-5" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-sidebar-accent border-sidebar-border">
            {label}
          </TooltipContent>
        </Tooltip>
      );
    }
    return (
      <Link
        href={href}
        className={cn(baseLinkClass, isItemActive ? activeLinkClass : inactiveLinkClass)}
      >
        <Icon className="h-5 w-5" />
        <span>{label}</span>
      </Link>
    );
  };

  // Sidebar content component - used for both desktop and mobile
  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => {
    // Use expanded view on mobile
    const showCollapsed = isMobile ? false : collapsed;

    return (
    <aside className={cn(
      'bg-sidebar text-sidebar-foreground flex flex-col h-full transition-all duration-300 ease-in-out',
      isMobile ? 'w-full' : (showCollapsed ? 'w-16' : 'w-72')
    )}>
        {/* Header / Logo */}
        <div className={cn(
          'border-b border-sidebar-border flex items-center',
          showCollapsed ? 'p-3 justify-center' : 'p-6 space-x-3'
        )}>
          {/* @ts-ignore */}
          <ShieldIcon className={cn(showCollapsed ? 'h-6 w-6' : 'h-8 w-8', 'text-sidebar-primary-foreground')} />
          {!showCollapsed && <span className="text-2xl font-semibold text-sidebar-primary-foreground">GLAPI</span>}
        </div>

      {/* Organization Switcher */}
      {!showCollapsed && (
        <div className="p-4 border-b border-sidebar-border">
          <OrganizationSwitcher
            afterCreateOrganizationUrl="/dashboard"
            afterSelectOrganizationUrl="/dashboard"
            appearance={{
              elements: {
                organizationSwitcherTrigger:
                  'w-full flex items-center justify-between p-3 rounded-md bg-sidebar-accent hover:bg-sidebar-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-sidebar focus:ring-sky-500 text-sm font-medium text-sidebar-foreground border border-transparent',
                organizationSwitcherPopoverCard:
                  'bg-sidebar-accent border-sidebar-border text-sidebar-foreground shadow-xl',
                organizationSwitcherPopoverActionButton:
                  'text-sidebar-foreground hover:bg-sidebar-hover px-3 py-2 rounded-md',
                organizationSwitcherPreviewButton:
                  'text-sidebar-foreground hover:bg-sidebar-hover px-3 py-2 rounded-md',
                organizationSwitcherCreateOrganizationButton:
                  'text-sidebar-foreground hover:bg-sidebar-hover px-3 py-2 rounded-md',
                organizationPreviewTextContainer: 'text-sidebar-foreground',
                organizationPreviewMainIdentifier: 'text-sidebar-foreground font-medium',
                organizationSwitcherErrorText: 'text-red-400 text-xs',
              },
            }}
          />
        </div>
      )}

      {/* Navigation */}
      <nav className={cn(
        'flex-1 overflow-y-auto',
        showCollapsed ? 'p-2 space-y-1' : 'p-4 space-y-2'
      )}>
        <div>
          {!showCollapsed && <h3 className="px-3 mb-2 text-xs font-semibold text-sidebar-section-header uppercase tracking-wider">Main</h3>}
          <ul className="space-y-1">
            <li>
              <CollapsedLinkWrapper href="/chat" icon={MessageCircleIcon} label="Chat" isItemActive={isActive('/chat')} isCollapsed={showCollapsed} />
            </li>
            <li>
              <CollapsedLinkWrapper href="/dashboard" icon={HomeIcon} label="Dashboard" isItemActive={isActive('/dashboard')} isCollapsed={showCollapsed} />
            </li>
            <li>
              <CollapsedLinkWrapper href="/reports" icon={FileTextIcon} label="Reports" isItemActive={isActive('/reports')} isCollapsed={showCollapsed} />
            </li>
          </ul>
        </div>

        {/* Workflows Section (Dynamic) */}
        {showCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/admin/settings/workflows"
                className={cn(
                  'flex items-center justify-center p-2.5 rounded-md',
                  isActive('/admin/settings/workflows') ? activeLinkClass : inactiveLinkClass
                )}
              >
                <WorkflowIcon className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-sidebar-accent border-sidebar-border">
              Workflows
            </TooltipContent>
          </Tooltip>
        ) : (
          <div>
            <button
              onClick={() => setIsWorkflowsSectionOpen(!isWorkflowsSectionOpen)}
              className={`${baseLinkClass} w-full justify-between text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-hover`}
            >
              <div className="flex items-center space-x-3">
                <WorkflowIcon className="h-5 w-5" />
                <span>Workflows</span>
              </div>
              {isWorkflowsSectionOpen ? <ChevronDownIcon className="h-5 w-5" /> : <ChevronRightIcon className="h-5 w-5" />}
            </button>
            {isWorkflowsSectionOpen && (
              <div className="mt-1 space-y-1">
                {/* Loading state */}
                {isLoadingWorkflows && (
                  <div className={`${baseSubLinkClass} text-sidebar-muted-foreground`}>
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                    <span>Loading workflows...</span>
                  </div>
                )}

                {/* Empty state */}
                {!isLoadingWorkflows && organizedWorkflows.length === 0 && (
                  <div className="px-3 py-2">
                    <p className="text-xs text-sidebar-muted-foreground mb-2">No workflows configured</p>
                    <Link
                      href="/admin/settings/workflows"
                      className="flex items-center space-x-2 text-xs text-sidebar-primary-foreground hover:underline"
                    >
                      <PlusIcon className="h-3 w-3" />
                      <span>Create your first workflow</span>
                    </Link>
                  </div>
                )}

                {/* Workflow list */}
                {!isLoadingWorkflows && organizedWorkflows.map(workflow => (
                  <div key={workflow.id}>
                    {/* Workflow header */}
                    <button
                      onClick={() => toggleWorkflow(workflow.id)}
                      className={`${baseSubLinkClass} w-full justify-between text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-hover`}
                    >
                      <div className="flex items-center space-x-3">
                        <FolderOpenIcon className="h-4 w-4" />
                        <span className="truncate">{workflow.name}</span>
                      </div>
                      {openWorkflows[workflow.id] ? (
                        <ChevronDownIcon className="h-4 w-4 flex-shrink-0" />
                      ) : (
                        <ChevronRightIcon className="h-4 w-4 flex-shrink-0" />
                      )}
                    </button>

                    {/* Workflow content */}
                    {openWorkflows[workflow.id] && (
                      <div className="mt-1 space-y-1">
                        {/* Render groups with their components */}
                        {workflow.groups
                          .sort((a, b) => a.displayOrder - b.displayOrder)
                          .map(group => {
                            const groupComponents = workflow.groupedComponents.get(group.id) || [];
                            if (groupComponents.length === 0) return null;

                            return (
                              <div key={group.id}>
                                {/* Group header */}
                                <button
                                  onClick={() => toggleWorkflowGroup(group.id)}
                                  className="pl-14 pr-3 py-2 rounded-md text-sm font-medium flex items-center justify-between w-full text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-hover"
                                >
                                  <span className="truncate">{group.name}</span>
                                  {openWorkflowGroups[group.id] ? (
                                    <ChevronDownIcon className="h-3 w-3 flex-shrink-0" />
                                  ) : (
                                    <ChevronRightIcon className="h-3 w-3 flex-shrink-0" />
                                  )}
                                </button>

                                {/* Group components */}
                                {openWorkflowGroups[group.id] && (
                                  <ul className="mt-1 space-y-1">
                                    {groupComponents.map(component => {
                                      const IconComponent = getIconComponent(component.icon);
                                      return (
                                        <li key={component.id}>
                                          <Link
                                            href={component.route}
                                            className={`pl-20 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${
                                              isActive(component.route) ? activeLinkClass : inactiveLinkClass
                                            }`}
                                          >
                                            <IconComponent className="h-3 w-3 opacity-75" />
                                            <span className="truncate">{component.displayName}</span>
                                          </Link>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </div>
                            );
                          })}

                        {/* Render ungrouped components */}
                        {(() => {
                          const ungroupedComponents = workflow.groupedComponents.get(null) || [];
                          if (ungroupedComponents.length === 0) return null;

                          return (
                            <ul className="mt-1 space-y-1">
                              {ungroupedComponents.map(component => {
                                const IconComponent = getIconComponent(component.icon);
                                return (
                                  <li key={component.id}>
                                    <Link
                                      href={component.route}
                                      className={`pl-14 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${
                                        isActive(component.route) ? activeLinkClass : inactiveLinkClass
                                      }`}
                                    >
                                      <IconComponent className="h-3 w-3 opacity-75" />
                                      <span className="truncate">{component.displayName}</span>
                                    </Link>
                                  </li>
                                );
                              })}
                            </ul>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                ))}

                {/* Manage Workflows link */}
                {!isLoadingWorkflows && (
                  <>
                    <div className="mx-3 my-2 border-t border-sidebar-border" />
                    <Link
                      href="/admin/settings/workflows"
                      className={`${baseSubLinkClass} ${
                        isActive('/admin/settings/workflows') ? activeLinkClass : inactiveLinkClass
                      }`}
                    >
                      <SettingsIcon className="h-4 w-4" />
                      <span>Manage Workflows</span>
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Lists Section (Expandable) */}
        {showCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/lists/items"
                className={cn(
                  'flex items-center justify-center p-2.5 rounded-md',
                  pathname.startsWith('/lists') || pathname.startsWith('/relationships') ? activeLinkClass : inactiveLinkClass
                )}
              >
                <ListChecksIcon className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-sidebar-accent border-sidebar-border">
              Lists
            </TooltipContent>
          </Tooltip>
        ) : (
          <div>
            <button
              onClick={() => setIsListsOpen(!isListsOpen)}
              className={`${baseLinkClass} w-full justify-between text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-hover`}
            >
              <div className="flex items-center space-x-3">
                <ListChecksIcon className="h-5 w-5" />
                <span>Lists</span>
              </div>
              {isListsOpen ? <ChevronDownIcon className="h-5 w-5" /> : <ChevronRightIcon className="h-5 w-5" />}
            </button>
            {isListsOpen && (
              <div className="mt-1 space-y-1">
                {/* Accounting Section */}
                <div>
                  <button
                    onClick={() => setIsAccountingOpen(!isAccountingOpen)}
                    className={`${baseSubLinkClass} w-full justify-between text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-hover`}
                  >
                    <div className="flex items-center space-x-3">
                      <WalletCardsIcon className="h-4 w-4" />
                      <span>Accounting</span>
                    </div>
                    {isAccountingOpen ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                  </button>
                  {isAccountingOpen && (
                    <ul className="mt-1 space-y-1">
                      <li>
                        <Link href="/lists/accounts" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/lists/accounts') ? activeLinkClass : inactiveLinkClass}`}>
                          <ListOrderedIcon className={`h-3 w-3 opacity-75`} />
                          <span>Accounts</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/lists/classes" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/lists/classes') ? activeLinkClass : inactiveLinkClass}`}>
                          <LibraryBigIcon className={`h-3 w-3 opacity-75`} />
                          <span>Classes</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/lists/departments" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/lists/departments') ? activeLinkClass : inactiveLinkClass}`}>
                          <NetworkIcon className={`h-3 w-3 opacity-75`} />
                          <span>Departments</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/lists/locations" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/lists/locations') ? activeLinkClass : inactiveLinkClass}`}>
                          <MapPinnedIcon className={`h-3 w-3 opacity-75`} />
                          <span>Locations</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/lists/subsidiaries" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/lists/subsidiaries') ? activeLinkClass : inactiveLinkClass}`}>
                          <BuildingIcon className={`h-3 w-3 opacity-75`} />
                          <span>Subsidiaries</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/lists/payment-terms" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/lists/payment-terms') ? activeLinkClass : inactiveLinkClass}`}>
                          <ClockIcon className={`h-3 w-3 opacity-75`} />
                          <span>Payment Terms</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/lists/payment-methods" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/lists/payment-methods') ? activeLinkClass : inactiveLinkClass}`}>
                          <CreditCardIcon className={`h-3 w-3 opacity-75`} />
                          <span>Payment Methods</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/lists/charge-types" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/lists/charge-types') ? activeLinkClass : inactiveLinkClass}`}>
                          <ZapIcon className={`h-3 w-3 opacity-75`} />
                          <span>Charge Types</span>
                        </Link>
                      </li>
                    </ul>
                  )}
                </div>

                {/* Relationships Section */}
                <div>
                  <button
                    onClick={() => setIsRelationshipsOpen(!isRelationshipsOpen)}
                    className={`${baseSubLinkClass} w-full justify-between text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-hover`}
                  >
                    <div className="flex items-center space-x-3">
                      <UsersIcon className="h-4 w-4" />
                      <span>Relationships</span>
                    </div>
                    {isRelationshipsOpen ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                  </button>
                  {isRelationshipsOpen && (
                    <ul className="mt-1 space-y-1">
                      <li>
                        <Link href="/relationships/customers" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/relationships/customers') ? activeLinkClass : inactiveLinkClass}`}>
                          <UsersIcon className={`h-3 w-3 opacity-75`} />
                          <span>Customers</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/relationships/vendors" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/relationships/vendors') ? activeLinkClass : inactiveLinkClass}`}>
                          <BriefcaseIcon className={`h-3 w-3 opacity-75`} />
                          <span>Vendors</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/relationships/employees" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/relationships/employees') ? activeLinkClass : inactiveLinkClass}`}>
                          <UsersIconComponent className={`h-3 w-3 opacity-75`} />
                          <span>Employees</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/relationships/leads" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/relationships/leads') ? activeLinkClass : inactiveLinkClass}`}>
                          <TicketIcon className={`h-3 w-3 opacity-75`} />
                          <span>Leads</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/relationships/prospects" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/relationships/prospects') ? activeLinkClass : inactiveLinkClass}`}>
                          <ShieldIcon className={`h-3 w-3 opacity-75`} />
                          <span>Prospects</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/relationships/contacts" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/relationships/contacts') ? activeLinkClass : inactiveLinkClass}`}>
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
                    className={`${baseSubLinkClass} w-full justify-between text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-hover`}
                  >
                    <div className="flex items-center space-x-3">
                      <PackageIcon className="h-4 w-4" />
                      <span>Items</span>
                    </div>
                    {isItemsOpen ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                  </button>
                  {isItemsOpen && (
                    <ul className="mt-1 space-y-1">
                      <li>
                        <Link href="/lists/units-of-measure" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/lists/units-of-measure') ? activeLinkClass : inactiveLinkClass}`}>
                          <RulerIcon className={`h-3 w-3 opacity-75`} />
                          <span>Units of Measure</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/lists/item-categories" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/lists/item-categories') ? activeLinkClass : inactiveLinkClass}`}>
                          <TagsIcon className={`h-3 w-3 opacity-75`} />
                          <span>Categories</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/lists/items" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/lists/items') ? activeLinkClass : inactiveLinkClass}`}>
                          <PackageIcon className={`h-3 w-3 opacity-75`} />
                          <span>Items</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/lists/warehouses" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/lists/warehouses') ? activeLinkClass : inactiveLinkClass}`}>
                          <Building2Icon className={`h-3 w-3 opacity-75`} />
                          <span>Warehouses</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/lists/price-lists" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/lists/price-lists') ? activeLinkClass : inactiveLinkClass}`}>
                          <TagsIcon className={`h-3 w-3 opacity-75`} />
                          <span>Price Lists</span>
                        </Link>
                      </li>
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        

        {/* Settings Section (Expandable) - NEW TOP LEVEL */}
        {showCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/admin/settings"
                className={cn(
                  'flex items-center justify-center p-2.5 rounded-md',
                  isActive('/admin/settings') ? activeLinkClass : inactiveLinkClass
                )}
              >
                <Settings2Icon className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-sidebar-accent border-sidebar-border">
              Settings
            </TooltipContent>
          </Tooltip>
        ) : (
          <div>
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`${baseLinkClass} w-full justify-between text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-hover`}
            >
              <div className="flex items-center space-x-3">
                <Settings2Icon className="h-5 w-5" />
                <span>Settings</span>
              </div>
              {isSettingsOpen ? <ChevronDownIcon className="h-5 w-5" /> : <ChevronRightIcon className="h-5 w-5" />}
            </button>
            {isSettingsOpen && (
              <ul className="mt-1 space-y-1">
                {/* Placeholder for future settings sub-items */}
                <li><span className={`${baseSubLinkClass} text-sidebar-muted-foreground`}>Sub-item 1</span></li>
                <li><span className={`${baseSubLinkClass} text-sidebar-muted-foreground`}>Sub-item 2</span></li>
              </ul>
            )}
          </div>
        )}

        {/* Transactions Section (Expandable) */}
        {showCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/transactions/sales/invoices"
                className={cn(
                  'flex items-center justify-center p-2.5 rounded-md',
                  pathname.startsWith('/transactions') ? activeLinkClass : inactiveLinkClass
                )}
              >
                <ArrowRightLeftIcon className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-sidebar-accent border-sidebar-border">
              Transactions
            </TooltipContent>
          </Tooltip>
        ) : (
          <div>
            <button
              onClick={() => setIsTransactionsOpen(!isTransactionsOpen)}
              className={`${baseLinkClass} w-full justify-between text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-hover`}
            >
              <div className="flex items-center space-x-3">
                <ArrowRightLeftIcon className="h-5 w-5" />
                <span>Transactions</span>
              </div>
              {isTransactionsOpen ? <ChevronDownIcon className="h-5 w-5" /> : <ChevronRightIcon className="h-5 w-5" />}
            </button>
            {isTransactionsOpen && (
              <div className="mt-1 space-y-1">
                {/* Management Section */}
                <div>
                  <button
                    onClick={() => setIsTransactionManagementOpen(!isTransactionManagementOpen)}
                    className={`${baseSubLinkClass} w-full justify-between text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-hover`}
                  >
                    <div className="flex items-center space-x-3">
                      <Settings2Icon className="h-4 w-4" />
                      <span>Management</span>
                    </div>
                    {isTransactionManagementOpen ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                  </button>
                  {isTransactionManagementOpen && (
                    <ul className="mt-1 space-y-1">
                      <li>
                        <Link href="/transactions/management/journal" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/transactions/management/journal') ? activeLinkClass : inactiveLinkClass}`}>
                          <BookOpenIcon className={`h-3 w-3 opacity-75`} />
                          <span>Journal</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/transactions/management/budgets" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/transactions/management/budgets') ? activeLinkClass : inactiveLinkClass}`}>
                          <CalendarIcon className={`h-3 w-3 opacity-75`} />
                          <span>Budgets</span>
                        </Link>
                      </li>
                    </ul>
                  )}
                </div>

                {/* Sales Section */}
                <div>
                  <button
                    onClick={() => setIsTransactionSalesOpen(!isTransactionSalesOpen)}
                    className={`${baseSubLinkClass} w-full justify-between text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-hover`}
                  >
                    <div className="flex items-center space-x-3">
                      <ShoppingCartIcon className="h-4 w-4" />
                      <span>Sales</span>
                    </div>
                    {isTransactionSalesOpen ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                  </button>
                  {isTransactionSalesOpen && (
                    <ul className="mt-1 space-y-1">
                      <li>
                        <Link href="/transactions/sales/estimates" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/transactions/sales/estimates') ? activeLinkClass : inactiveLinkClass}`}>
                          <FileBarChartIcon className={`h-3 w-3 opacity-75`} />
                          <span>Estimates</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/transactions/sales/sales-orders" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/transactions/sales/sales-orders') ? activeLinkClass : inactiveLinkClass}`}>
                          <ListOrderedIcon className={`h-3 w-3 opacity-75`} />
                          <span>Sales Orders</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/transactions/sales/opportunities" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/transactions/sales/opportunities') ? activeLinkClass : inactiveLinkClass}`}>
                          <TargetIcon className={`h-3 w-3 opacity-75`} />
                          <span>Opportunities</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/transactions/sales/fulfillment" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/transactions/sales/fulfillment') ? activeLinkClass : inactiveLinkClass}`}>
                          <TruckIcon className={`h-3 w-3 opacity-75`} />
                          <span>Fulfillment</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/transactions/sales/invoices" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/transactions/sales/invoices') ? activeLinkClass : inactiveLinkClass}`}>
                          <FileTextIcon className={`h-3 w-3 opacity-75`} />
                          <span>Invoices</span>
                        </Link>
                      </li>
                    </ul>
                  )}
                </div>

                {/* Inventory Section */}
                <div>
                  <button
                    onClick={() => setIsTransactionInventoryOpen(!isTransactionInventoryOpen)}
                    className={`${baseSubLinkClass} w-full justify-between text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-hover`}
                  >
                    <div className="flex items-center space-x-3">
                      <WarehouseIcon className="h-4 w-4" />
                      <span>Inventory</span>
                    </div>
                    {isTransactionInventoryOpen ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                  </button>
                  {isTransactionInventoryOpen && (
                    <ul className="mt-1 space-y-1">
                      <li>
                        <Link href="/transactions/inventory/adjustments" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/transactions/inventory/adjustments') ? activeLinkClass : inactiveLinkClass}`}>
                          <Settings2Icon className={`h-3 w-3 opacity-75`} />
                          <span>Adjustments</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/transactions/inventory/transfers" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/transactions/inventory/transfers') ? activeLinkClass : inactiveLinkClass}`}>
                          <ArrowRightLeftIcon className={`h-3 w-3 opacity-75`} />
                          <span>Transfers</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/transactions/inventory/receipts" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/transactions/inventory/receipts') ? activeLinkClass : inactiveLinkClass}`}>
                          <PackageIcon className={`h-3 w-3 opacity-75`} />
                          <span>Receipts</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/transactions/inventory/purchase-orders" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/transactions/inventory/purchase-orders') ? activeLinkClass : inactiveLinkClass}`}>
                          <ShoppingCartIcon className={`h-3 w-3 opacity-75`} />
                          <span>Purchase Orders</span>
                        </Link>
                      </li>
                    </ul>
                  )}
                </div>

                {/* Recurring Revenue (ASC606) Section */}
                <div>
                  <button
                    onClick={() => setIsTransactionRecurringOpen(!isTransactionRecurringOpen)}
                    className={`${baseSubLinkClass} w-full justify-between text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-hover`}
                  >
                    <div className="flex items-center space-x-3">
                      <CalendarIcon className="h-4 w-4" />
                      <span>Recurring Revenue</span>
                    </div>
                    {isTransactionRecurringOpen ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                  </button>
                  {isTransactionRecurringOpen && (
                    <ul className="mt-1 space-y-1">
                      <li>
                        <Link href="/transactions/recurring/contracts" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/transactions/recurring/contracts') ? activeLinkClass : inactiveLinkClass}`}>
                          <FileTextIcon className={`h-3 w-3 opacity-75`} />
                          <span>Contracts</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/transactions/recurring/performance-obligations" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/transactions/recurring/performance-obligations') ? activeLinkClass : inactiveLinkClass}`}>
                          <TargetIcon className={`h-3 w-3 opacity-75`} />
                          <span>Performance Obligations</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/transactions/recurring/revenue-recognition" className={`pl-16 pr-3 py-2 rounded-md text-sm font-medium flex items-center space-x-3 ${isActive('/transactions/recurring/revenue-recognition') ? activeLinkClass : inactiveLinkClass}`}>
                          <DollarSignIcon className={`h-3 w-3 opacity-75`} />
                          <span>Revenue Recognition</span>
                        </Link>
                      </li>
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Account Section */}
        {!showCollapsed && (
          <div>
            <h3 className="px-3 mb-2 mt-4 text-xs font-semibold text-sidebar-section-header uppercase tracking-wider">Account</h3>
            <ul className="space-y-1">
              <li>
                {/* @ts-ignore */}
                <Link href="/admin/settings"
                      className={`${baseLinkClass} ${isActive('/admin/settings') ? activeLinkClass : inactiveLinkClass}`}>
                  {/* @ts-ignore */}
                  <SettingsIcon className="h-5 w-5" />
                  <span>Admin Settings</span>
                </Link>
              </li>
            </ul>
          </div>
        )}
        {showCollapsed && (
          <div className="mt-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/admin/settings"
                  className={cn(
                    'flex items-center justify-center p-2.5 rounded-md',
                    isActive('/admin/settings') ? activeLinkClass : inactiveLinkClass
                  )}
                >
                  <SettingsIcon className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-sidebar-accent border-sidebar-border">
                Admin Settings
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </nav>

      {/* Footer / UserButton (Clerk) + Collapse Toggle */}
      <div className={cn(
        'border-t border-sidebar-border mt-auto',
        showCollapsed ? 'p-2' : 'p-4'
      )}>
        {/* Collapse toggle button - hidden on mobile */}
        {onToggleCollapse && !isMobile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className={cn(
              'mb-3 text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-hover',
              showCollapsed ? 'w-full justify-center p-2' : 'w-full justify-start'
            )}
          >
            {showCollapsed ? (
              <PanelLeftIcon className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftCloseIcon className="h-4 w-4 mr-2" />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </Button>
        )}

        {user && (
          <div className={cn(
            'flex items-center',
            showCollapsed ? 'justify-center' : 'space-x-3'
          )}>
            <UserButton afterSignOutUrl="/" />
            {!showCollapsed && (
              <div className="text-sm">
                <p className="font-medium text-sidebar-primary-foreground truncate max-w-[140px]">
                  {user.fullName || user.primaryEmailAddress?.emailAddress}
                </p>
              </div>
            )}
          </div>
        )}
        {!user && (
          showCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/sign-in"
                  className="flex items-center justify-center p-2.5 rounded-md text-sidebar-muted-foreground hover:bg-sidebar-hover hover:text-sidebar-foreground"
                >
                  <LogOutIcon className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-sidebar-accent border-sidebar-border">
                Sign In
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/sign-in"
              className="flex items-center space-x-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-muted-foreground hover:bg-sidebar-hover hover:text-sidebar-foreground"
            >
              <LogOutIcon className="h-5 w-5" />
              <span>Sign In</span>
            </Link>
          )
        )}
      </div>
      </aside>
    );
  };

  return (
    <TooltipProvider delayDuration={0}>
      {/* Desktop sidebar - hidden on mobile */}
      <div className="hidden md:block h-screen">
        <SidebarContent />
      </div>

      {/* Mobile sidebar - Sheet component */}
      <Sheet open={isMobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          side="left"
          className="p-0 w-72 bg-sidebar border-sidebar-border"
          showCloseButton={false}
        >
          <SidebarContent isMobile />
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
};

export default NewPageSidebar; 