'use client';

import * as React from 'react';
import { useOrganization, useOrganizationList, useAuth } from '@clerk/nextjs';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, ChevronsUpDown, Building2, Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrganizationSwitcherProps {
  /** Where to redirect after creating a new organization */
  afterCreateOrganizationUrl?: string;
  /** Where to redirect after selecting a different organization */
  afterSelectOrganizationUrl?: string;
  /** Additional CSS classes for the trigger button */
  className?: string;
  /** Whether to show in a compact collapsed mode (icon only) */
  collapsed?: boolean;
}

/**
 * Custom Organization Switcher component that integrates with Clerk
 * and invalidates all TanStack Query caches when switching organizations.
 */
export function OrganizationSwitcher({
  afterCreateOrganizationUrl = '/dashboard',
  afterSelectOrganizationUrl = '/dashboard',
  className,
  collapsed = false,
}: OrganizationSwitcherProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { orgId } = useAuth();
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const {
    userMemberships,
    setActive,
    isLoaded: listLoaded
  } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  });

  const [isSwitching, setIsSwitching] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);

  // Loading state
  const isLoading = !orgLoaded || !listLoaded;

  // Get list of organizations from memberships
  const organizations = React.useMemo(() => {
    if (!userMemberships?.data) return [];
    return userMemberships.data.map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      imageUrl: membership.organization.imageUrl,
      slug: membership.organization.slug,
    }));
  }, [userMemberships?.data]);

  // Handle organization switch
  const handleSwitch = React.useCallback(async (organizationId: string) => {
    if (!setActive) return;
    if (organizationId === organization?.id) {
      setIsOpen(false);
      return;
    }

    setIsSwitching(true);
    try {
      // Switch the active organization in Clerk
      await setActive({ organization: organizationId });

      // Invalidate all queries to refetch with new org context
      await queryClient.invalidateQueries();

      // Show success toast
      const newOrg = organizations.find((o) => o.id === organizationId);
      toast.success(`Switched to ${newOrg?.name || 'organization'}`);

      // Navigate to the specified URL after switch
      if (afterSelectOrganizationUrl) {
        router.push(afterSelectOrganizationUrl);
      }
    } catch (error) {
      console.error('Failed to switch organization:', error);
      toast.error('Failed to switch organization. Please try again.');
    } finally {
      setIsSwitching(false);
      setIsOpen(false);
    }
  }, [setActive, organization?.id, queryClient, organizations, afterSelectOrganizationUrl, router]);

  // Handle create new organization
  const handleCreateOrganization = React.useCallback(() => {
    // Clerk's createOrganization modal can be triggered via their components
    // For now, we'll just redirect to a create page or show a message
    setIsOpen(false);
    // You could also use Clerk's CreateOrganization component/modal here
    toast.info('Creating organizations is available in your account settings.');
  }, []);

  // Get initials for fallback avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Skeleton className={cn(collapsed ? 'h-8 w-8 rounded-md' : 'h-10 w-full rounded-md')} />
      </div>
    );
  }

  // No organizations - show create prompt
  if (organizations.length === 0) {
    return (
      <Button
        variant="outline"
        className={cn(
          'w-full justify-start gap-2 bg-sidebar-accent hover:bg-sidebar-hover border-sidebar-border text-sidebar-foreground',
          collapsed && 'justify-center p-2',
          className
        )}
        onClick={handleCreateOrganization}
      >
        <Plus className="h-4 w-4" />
        {!collapsed && <span>Create Organization</span>}
      </Button>
    );
  }

  // Single organization - show without dropdown
  if (organizations.length === 1 && organization) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 p-3 rounded-md bg-sidebar-accent text-sidebar-foreground',
          collapsed && 'justify-center p-2',
          className
        )}
      >
        <Avatar className="h-8 w-8">
          {organization.imageUrl ? (
            <AvatarImage src={organization.imageUrl} alt={organization.name} />
          ) : null}
          <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
            {getInitials(organization.name)}
          </AvatarFallback>
        </Avatar>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{organization.name}</p>
          </div>
        )}
      </div>
    );
  }

  // Multiple organizations - show dropdown
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          aria-label="Select organization"
          disabled={isSwitching}
          className={cn(
            'w-full justify-between bg-sidebar-accent hover:bg-sidebar-hover border-sidebar-border text-sidebar-foreground',
            collapsed && 'justify-center p-2',
            className
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            {isSwitching ? (
              <Loader2 className="h-5 w-5 animate-spin text-sidebar-muted-foreground" />
            ) : organization ? (
              <Avatar className="h-6 w-6">
                {organization.imageUrl ? (
                  <AvatarImage src={organization.imageUrl} alt={organization.name} />
                ) : null}
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-[10px]">
                  {getInitials(organization.name)}
                </AvatarFallback>
              </Avatar>
            ) : (
              <Building2 className="h-5 w-5 text-sidebar-muted-foreground" />
            )}
            {!collapsed && (
              <span className="truncate text-sm font-medium">
                {isSwitching ? 'Switching...' : organization?.name || 'Select organization'}
              </span>
            )}
          </div>
          {!collapsed && (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[240px] bg-sidebar-accent border-sidebar-border"
        align="start"
        sideOffset={4}
      >
        <DropdownMenuLabel className="text-sidebar-muted-foreground text-xs font-normal">
          Organizations
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-sidebar-border" />
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onSelect={() => handleSwitch(org.id)}
            disabled={isSwitching}
            className={cn(
              'flex items-center gap-3 cursor-pointer py-2',
              'text-sidebar-foreground hover:bg-sidebar-hover focus:bg-sidebar-hover',
              org.id === organization?.id && 'bg-sidebar-hover'
            )}
          >
            <Avatar className="h-6 w-6">
              {org.imageUrl ? (
                <AvatarImage src={org.imageUrl} alt={org.name} />
              ) : null}
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-[10px]">
                {getInitials(org.name)}
              </AvatarFallback>
            </Avatar>
            <span className="flex-1 truncate text-sm">{org.name}</span>
            {org.id === organization?.id && (
              <Check className="h-4 w-4 text-sidebar-primary-foreground" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="bg-sidebar-border" />
        <DropdownMenuItem
          onSelect={handleCreateOrganization}
          className="flex items-center gap-3 cursor-pointer py-2 text-sidebar-muted-foreground hover:bg-sidebar-hover focus:bg-sidebar-hover"
        >
          <Plus className="h-4 w-4" />
          <span className="text-sm">Create organization</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default OrganizationSwitcher;
