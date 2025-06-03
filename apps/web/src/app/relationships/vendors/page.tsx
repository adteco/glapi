'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@clerk/nextjs';
import { apiEndpoints } from '@/lib/api';
import { Eye, Pencil, Trash2, Plus } from 'lucide-react';

interface Address {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
}

interface VendorMetadata {
  paymentTerms?: string;
  vendorType?: string;
  ein?: string;
  w9OnFile?: boolean;
  defaultExpenseAccount?: string;
}

interface Vendor {
  id: string;
  name: string;
  displayName?: string | null;
  code?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: Address | null;
  taxId?: string | null;
  description?: string | null;
  notes?: string | null;
  metadata?: VendorMetadata | null;
  status: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  name: string;
  displayName: string;
  code: string;
  email: string;
  phone: string;
  website: string;
  taxId: string;
  description: string;
  notes: string;
  status: string;
  address: {
    line1: string;
    line2: string;
    city: string;
    stateProvince: string;
    postalCode: string;
    countryCode: string;
  };
  metadata: {
    paymentTerms: string;
    vendorType: string;
    ein: string;
    w9OnFile: boolean;
    defaultExpenseAccount: string;
  };
}

interface VendorFormProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}

// Move VendorForm outside of the main component
const VendorForm: React.FC<VendorFormProps> = ({ formData, setFormData }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="name">Vendor Name*</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="displayName">Display Name</Label>
        <Input
          id="displayName"
          value={formData.displayName}
          onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="code">Vendor Code</Label>
        <Input
          id="code"
          value={formData.code}
          onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ein">EIN</Label>
        <Input
          id="ein"
          value={formData.metadata.ein}
          onChange={(e) => setFormData(prev => ({ 
            ...prev, 
            metadata: { ...prev.metadata, ein: e.target.value }
          }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          value={formData.phone}
          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="website">Website</Label>
        <Input
          id="website"
          value={formData.website}
          onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select
          value={formData.status}
          onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
    
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="vendorType">Vendor Type</Label>
        <Input
          id="vendorType"
          value={formData.metadata.vendorType}
          onChange={(e) => setFormData(prev => ({ 
            ...prev, 
            metadata: { ...prev.metadata, vendorType: e.target.value }
          }))}
          placeholder="e.g., Supplier, Contractor, Service Provider"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="paymentTerms">Payment Terms</Label>
        <Input
          id="paymentTerms"
          value={formData.metadata.paymentTerms}
          onChange={(e) => setFormData(prev => ({ 
            ...prev, 
            metadata: { ...prev.metadata, paymentTerms: e.target.value }
          }))}
          placeholder="e.g., Net 30, Net 60"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="defaultExpenseAccount">Default Expense Account</Label>
        <Input
          id="defaultExpenseAccount"
          value={formData.metadata.defaultExpenseAccount}
          onChange={(e) => setFormData(prev => ({ 
            ...prev, 
            metadata: { ...prev.metadata, defaultExpenseAccount: e.target.value }
          }))}
        />
      </div>
      <div className="flex items-center space-x-2">
        <Switch
          id="w9OnFile"
          checked={formData.metadata.w9OnFile}
          onCheckedChange={(checked) => setFormData(prev => ({ 
            ...prev, 
            metadata: { ...prev.metadata, w9OnFile: checked }
          }))}
        />
        <Label htmlFor="w9OnFile">W-9 On File</Label>
      </div>
    </div>
    
    <div className="space-y-2">
      <Label>Address</Label>
      <div className="grid grid-cols-2 gap-4">
        <Input
          placeholder="Address Line 1"
          value={formData.address.line1}
          onChange={(e) => setFormData(prev => ({ 
            ...prev, 
            address: { ...prev.address, line1: e.target.value }
          }))}
        />
        <Input
          placeholder="Address Line 2"
          value={formData.address.line2}
          onChange={(e) => setFormData(prev => ({ 
            ...prev, 
            address: { ...prev.address, line2: e.target.value }
          }))}
        />
        <Input
          placeholder="City"
          value={formData.address.city}
          onChange={(e) => setFormData(prev => ({ 
            ...prev, 
            address: { ...prev.address, city: e.target.value }
          }))}
        />
        <Input
          placeholder="State/Province"
          value={formData.address.stateProvince}
          onChange={(e) => setFormData(prev => ({ 
            ...prev, 
            address: { ...prev.address, stateProvince: e.target.value }
          }))}
        />
        <Input
          placeholder="Postal Code"
          value={formData.address.postalCode}
          onChange={(e) => setFormData(prev => ({ 
            ...prev, 
            address: { ...prev.address, postalCode: e.target.value }
          }))}
        />
        <Input
          placeholder="Country Code (e.g., US)"
          value={formData.address.countryCode}
          maxLength={2}
          onChange={(e) => setFormData(prev => ({ 
            ...prev, 
            address: { ...prev.address, countryCode: e.target.value.toUpperCase() }
          }))}
        />
      </div>
    </div>
    
    <div className="space-y-2">
      <Label htmlFor="description">Description</Label>
      <Textarea
        id="description"
        value={formData.description}
        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
        rows={3}
      />
    </div>
    
    <div className="space-y-2">
      <Label htmlFor="notes">Notes</Label>
      <Textarea
        id="notes"
        value={formData.notes}
        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
        rows={3}
      />
    </div>
  </div>
);

export default function VendorsPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    code: '',
    email: '',
    phone: '',
    website: '',
    taxId: '',
    description: '',
    notes: '',
    status: 'active',
    address: {
      line1: '',
      line2: '',
      city: '',
      stateProvince: '',
      postalCode: '',
      countryCode: '',
    },
    metadata: {
      paymentTerms: '',
      vendorType: '',
      ein: '',
      w9OnFile: false,
      defaultExpenseAccount: '',
    }
  });

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const token = await getToken();
      const response = await fetch(apiEndpoints.vendors, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch vendors');
      
      const data = await response.json();
      setVendors(data.data || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const token = await getToken();
      const response = await fetch(apiEndpoints.vendors, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          displayName: formData.displayName || undefined,
          code: formData.code || undefined,
          entityTypes: ['Vendor'],
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          website: formData.website || undefined,
          taxId: formData.taxId || undefined,
          description: formData.description || undefined,
          notes: formData.notes || undefined,
          status: formData.status,
          isActive: true,
          address: formData.address.line1 || formData.address.city ? {
            line1: formData.address.line1 || undefined,
            line2: formData.address.line2 || undefined,
            city: formData.address.city || undefined,
            stateProvince: formData.address.stateProvince || undefined,
            postalCode: formData.address.postalCode || undefined,
            countryCode: formData.address.countryCode || undefined,
          } : undefined,
          metadata: {
            paymentTerms: formData.metadata.paymentTerms || undefined,
            vendorType: formData.metadata.vendorType || undefined,
            ein: formData.metadata.ein || undefined,
            w9OnFile: formData.metadata.w9OnFile,
            defaultExpenseAccount: formData.metadata.defaultExpenseAccount || undefined,
          },
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Create vendor error:', errorData);
        throw new Error(errorData.error || errorData.message || 'Failed to create vendor');
      }
      
      await fetchVendors();
      setIsCreateOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error creating vendor:', error);
      alert(error instanceof Error ? error.message : 'Failed to create vendor');
    }
  };

  const handleUpdate = async () => {
    if (!selectedVendor) return;
    
    try {
      const token = await getToken();
      const response = await fetch(`${apiEndpoints.vendors}/${selectedVendor.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          displayName: formData.displayName || undefined,
          code: formData.code || undefined,
          entityTypes: ['Vendor'],
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          website: formData.website || undefined,
          taxId: formData.taxId || undefined,
          description: formData.description || undefined,
          notes: formData.notes || undefined,
          status: formData.status,
          isActive: true,
          address: formData.address.line1 || formData.address.city ? {
            line1: formData.address.line1 || undefined,
            line2: formData.address.line2 || undefined,
            city: formData.address.city || undefined,
            stateProvince: formData.address.stateProvince || undefined,
            postalCode: formData.address.postalCode || undefined,
            countryCode: formData.address.countryCode || undefined,
          } : undefined,
          metadata: {
            paymentTerms: formData.metadata.paymentTerms || undefined,
            vendorType: formData.metadata.vendorType || undefined,
            ein: formData.metadata.ein || undefined,
            w9OnFile: formData.metadata.w9OnFile,
            defaultExpenseAccount: formData.metadata.defaultExpenseAccount || undefined,
          },
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Update vendor error:', errorData);
        throw new Error(errorData.error || errorData.message || 'Failed to update vendor');
      }
      
      await fetchVendors();
      setIsEditOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error updating vendor:', error);
      alert(error instanceof Error ? error.message : 'Failed to update vendor');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this vendor?')) return;
    
    try {
      const token = await getToken();
      const response = await fetch(`${apiEndpoints.vendors}/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to delete vendor');
      
      await fetchVendors();
    } catch (error) {
      console.error('Error deleting vendor:', error);
    }
  };

  const openEditDialog = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setFormData({
      name: vendor.name,
      displayName: vendor.displayName || '',
      code: vendor.code || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      website: vendor.website || '',
      taxId: vendor.taxId || '',
      description: vendor.description || '',
      notes: vendor.notes || '',
      status: vendor.status,
      address: {
        line1: vendor.address?.line1 || '',
        line2: vendor.address?.line2 || '',
        city: vendor.address?.city || '',
        stateProvince: vendor.address?.stateProvince || '',
        postalCode: vendor.address?.postalCode || '',
        countryCode: vendor.address?.countryCode || '',
      },
      metadata: {
        paymentTerms: vendor.metadata?.paymentTerms || '',
        vendorType: vendor.metadata?.vendorType || '',
        ein: vendor.metadata?.ein || '',
        w9OnFile: vendor.metadata?.w9OnFile || false,
        defaultExpenseAccount: vendor.metadata?.defaultExpenseAccount || '',
      }
    });
    setIsEditOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      displayName: '',
      code: '',
      email: '',
      phone: '',
      website: '',
      taxId: '',
      description: '',
      notes: '',
      status: 'active',
      address: {
        line1: '',
        line2: '',
        city: '',
        stateProvince: '',
        postalCode: '',
        countryCode: '',
      },
      metadata: {
        paymentTerms: '',
        vendorType: '',
        ein: '',
        w9OnFile: false,
        defaultExpenseAccount: '',
      }
    });
    setSelectedVendor(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Remove the VendorForm definition from here since it's now outside

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Vendors</CardTitle>
              <CardDescription>Manage your vendor relationships</CardDescription>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Vendor
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Vendor</DialogTitle>
                  <DialogDescription>
                    Add a new vendor to your organization
                  </DialogDescription>
                </DialogHeader>
                <VendorForm formData={formData} setFormData={setFormData} />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>W-9</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.map((vendor) => (
                <TableRow key={vendor.id}>
                  <TableCell className="font-medium">
                    {vendor.displayName || vendor.name}
                  </TableCell>
                  <TableCell>{vendor.code || '-'}</TableCell>
                  <TableCell>{vendor.metadata?.vendorType || '-'}</TableCell>
                  <TableCell>{vendor.email || '-'}</TableCell>
                  <TableCell>{vendor.phone || '-'}</TableCell>
                  <TableCell>
                    {vendor.metadata?.w9OnFile ? (
                      <Badge variant="default">Yes</Badge>
                    ) : (
                      <Badge variant="secondary">No</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={vendor.status === 'active' ? 'default' : 'secondary'}>
                      {vendor.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => router.push(`/relationships/vendors/${vendor.id}`)}
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">View</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => openEditDialog(vendor)}
                        title="Edit vendor"
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDelete(vendor.id)}
                        title="Delete vendor"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {vendors.length === 0 && (
            <div className="text-center py-10 text-gray-500">
              No vendors found. Create your first vendor to get started.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Vendor</DialogTitle>
            <DialogDescription>
              Update vendor information
            </DialogDescription>
          </DialogHeader>
          <VendorForm />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}