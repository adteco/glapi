'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Plus,
  Mail,
  Phone,
  Users,
  MoreHorizontal,
  Star,
  StarOff,
  UserMinus,
  Edit2,
  Search,
  UserPlus,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface EntityContactsListProps {
  entityId: string;
  entityName?: string;
  showHeader?: boolean;
  allowCreate?: boolean;
}

interface ContactAssociation {
  id: string;
  entityId: string;
  contactId: string;
  role: string | null;
  isPrimary: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  contact: {
    id: string;
    name: string;
    displayName: string | null;
    email: string | null;
    phone: string | null;
    status: string;
  };
}

interface Contact {
  id: string;
  name: string;
  email?: string | null;
}

export function EntityContactsList({
  entityId,
  entityName = 'entity',
  showHeader = true,
  allowCreate = true,
}: EntityContactsListProps) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch associated contacts
  const { data: contacts, isLoading } = trpc.entityContacts.listContacts.useQuery(
    { entityId },
    { enabled: !!entityId }
  );

  // Fetch available contacts for adding
  const { data: availableContacts } = trpc.contacts.list.useQuery(
    { page: 1, limit: 100 },
    { enabled: isAddDialogOpen }
  );

  // Fetch contact roles
  const { data: roles } = trpc.entityContacts.getRoles.useQuery();

  // Add contact mutation
  const addContact = trpc.entityContacts.addContact.useMutation({
    onSuccess: () => {
      toast.success('Contact added successfully');
      setIsAddDialogOpen(false);
      utils.entityContacts.listContacts.invalidate({ entityId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Update contact mutation
  const updateContact = trpc.entityContacts.updateContact.useMutation({
    onSuccess: () => {
      toast.success('Contact updated successfully');
      setIsEditDialogOpen(false);
      setSelectedContact(null);
      utils.entityContacts.listContacts.invalidate({ entityId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Remove contact mutation
  const removeContact = trpc.entityContacts.removeContact.useMutation({
    onSuccess: () => {
      toast.success('Contact removed');
      utils.entityContacts.listContacts.invalidate({ entityId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Set primary contact mutation
  const setPrimary = trpc.entityContacts.setPrimaryContact.useMutation({
    onSuccess: () => {
      toast.success('Primary contact updated');
      utils.entityContacts.listContacts.invalidate({ entityId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleAddContact = (contactId: string, role?: string) => {
    addContact.mutate({
      entityId,
      contactId,
      role,
      isPrimary: false,
    });
  };

  const handleEditContact = (contact: any) => {
    setSelectedContact(contact);
    setIsEditDialogOpen(true);
  };

  const handleUpdateContact = (data: { role?: string; notes?: string }) => {
    if (!selectedContact) return;
    updateContact.mutate({
      entityId,
      contactId: selectedContact.contactId,
      ...data,
    });
  };

  const handleRemoveContact = (contactId: string) => {
    if (confirm('Remove this contact from the entity?')) {
      removeContact.mutate({ entityId, contactId });
    }
  };

  const handleSetPrimary = (contactId: string) => {
    setPrimary.mutate({ entityId, contactId });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Filter available contacts (exclude already associated)
  const associatedContactIds = new Set(contacts?.map((c: ContactAssociation) => c.contactId) ?? []);
  const filteredAvailableContacts = availableContacts?.data?.filter(
    (c: Contact) =>
      !associatedContactIds.has(c.id) &&
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  if (isLoading) {
    return (
      <Card className="border-border shadow-sm">
        {showHeader && (
          <CardHeader className="border-b border-border bg-muted/50">
            <CardTitle className="text-base font-medium">Contacts</CardTitle>
          </CardHeader>
        )}
        <CardContent className="p-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-sm">
      {showHeader && (
        <CardHeader className="border-b border-border bg-muted/50">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-base font-medium">Contacts</CardTitle>
              <CardDescription>People associated with this {entityName}</CardDescription>
            </div>
            {allowCreate && (
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Contact
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Contact</DialogTitle>
                    <DialogDescription>
                      Search for an existing contact or create a new one.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search contacts..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {filteredAvailableContacts.length === 0 ? (
                        <div className="text-center py-8 text-sm text-muted-foreground">
                          {searchQuery
                            ? 'No contacts found'
                            : 'No available contacts'}
                        </div>
                      ) : (
                        filteredAvailableContacts.map((contact: any) => (
                          <div
                            key={contact.id}
                            className="flex items-center justify-between p-3 rounded-lg hover:bg-muted cursor-pointer"
                            onClick={() => handleAddContact(contact.id)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-xs font-medium text-primary">
                                  {getInitials(contact.name)}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-medium">{contact.name}</p>
                                {contact.email && (
                                  <p className="text-xs text-muted-foreground">{contact.email}</p>
                                )}
                              </div>
                            </div>
                            <UserPlus className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ))
                      )}
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setIsAddDialogOpen(false);
                        router.push(`/relationships/contacts/new?returnTo=${encodeURIComponent(window.location.pathname)}`);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Contact
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
      )}
      <CardContent className="p-0">
        {!contacts || contacts.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">No contacts associated</p>
            {allowCreate && (
              <Button size="sm" variant="outline" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Contact
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {contacts.map((association: ContactAssociation) => (
              <div
                key={association.id}
                className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <div
                  className="flex items-center gap-4 cursor-pointer flex-1"
                  onClick={() => router.push(`/relationships/contacts/${association.contactId}`)}
                >
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center relative">
                    <span className="text-sm font-medium text-muted-foreground">
                      {getInitials(association.contact.name)}
                    </span>
                    {association.isPrimary && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary rounded-full flex items-center justify-center">
                        <Star className="h-2.5 w-2.5 text-primary-foreground fill-current" />
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{association.contact.name}</p>
                      {association.role && (
                        <Badge variant="secondary" className="text-xs">
                          {association.role}
                        </Badge>
                      )}
                      {association.isPrimary && (
                        <Badge variant="default" className="text-xs">
                          Primary
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {association.contact.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {association.contact.email}
                        </span>
                      )}
                      {association.contact.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {association.contact.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => router.push(`/relationships/contacts/${association.contactId}`)}>
                      View Contact
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleEditContact(association)}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit Role/Notes
                    </DropdownMenuItem>
                    {!association.isPrimary && (
                      <DropdownMenuItem onClick={() => handleSetPrimary(association.contactId)}>
                        <Star className="h-4 w-4 mr-2" />
                        Set as Primary
                      </DropdownMenuItem>
                    )}
                    {association.contact.email && (
                      <DropdownMenuItem
                        onClick={() => (window.location.href = `mailto:${association.contact.email}`)}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Send Email
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleRemoveContact(association.contactId)}
                    >
                      <UserMinus className="h-4 w-4 mr-2" />
                      Remove from {entityName}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Edit Contact Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Contact Association</DialogTitle>
            <DialogDescription>
              Update the role and notes for {selectedContact?.contact?.name}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleUpdateContact({
                role: formData.get('role') as string || undefined,
                notes: formData.get('notes') as string || undefined,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select name="role" defaultValue={selectedContact?.role || ''}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No role</SelectItem>
                  {roles?.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                name="notes"
                placeholder="Optional notes about this contact..."
                defaultValue={selectedContact?.notes || ''}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateContact.isPending}>
                {updateContact.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
