'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
import { useAuth } from '@clerk/nextjs';
import { useApiClient } from '@/lib/api-client.client';
import { Eye, Pencil, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface EmployeeMetadata {
  employeeId?: string;
  department?: string;
  title?: string;
  reportsTo?: string;
  startDate?: string;
  employmentType?: string;
}

interface Employee {
  id: string;
  name: string;
  displayName?: string | null;
  code?: string | null;
  email?: string | null;
  phone?: string | null;
  metadata?: EmployeeMetadata | null;
  status: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function EmployeesPage() {
  const { orgId } = useAuth();
  const { apiGet, apiPost, apiPut, apiDelete } = useApiClient();
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const previousOrgIdRef = useRef<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    code: '',
    email: '',
    phone: '',
    status: 'active',
    metadata: {
      employeeId: '',
      department: '',
      title: '',
      employmentType: 'full-time',
      startDate: '',
    }
  });

  const fetchEmployees = useCallback(async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiGet<{ data: Employee[] }>('/api/employees');
      console.log('Fetched employees:', data);
      setEmployees(data.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to fetch employees.');
    } finally {
      setLoading(false);
    }
  }, [orgId, apiGet]);

  // Clear data and refetch when organization changes
  useEffect(() => {
    if (orgId && orgId !== previousOrgIdRef.current) {
      // Clear existing data immediately when org changes
      setEmployees([]);
      previousOrgIdRef.current = orgId;
    }
    fetchEmployees();
  }, [orgId, fetchEmployees]);


  const handleCreate = async () => {
    try {
      if (!formData.name) {
        toast.error('Full name is required');
        return;
      }

      if (!orgId) {
        toast.error('Organization not selected.');
        return;
      }

      const newEmployee = await apiPost<Employee>('/api/employees', {
        name: formData.name,
        displayName: formData.displayName || undefined,
        code: formData.code || undefined,
        entityTypes: ['Employee'],
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        status: formData.status,
        isActive: true,
        metadata: {
          employeeId: formData.metadata.employeeId || undefined,
          department: formData.metadata.department || undefined,
          title: formData.metadata.title || undefined,
          employmentType: formData.metadata.employmentType || undefined,
          startDate: formData.metadata.startDate || undefined,
        },
      });
      
      console.log('Employee created successfully:', newEmployee);
      toast.success('Employee created successfully.');
      
      await fetchEmployees();
      setIsCreateOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error creating employee:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create employee');
    }
  };

  const handleUpdate = async () => {
    if (!selectedEmployee) return;
    
    try {
      if (!orgId) {
        toast.error('Organization not selected.');
        return;
      }

      await apiPut(`/api/employees/${selectedEmployee.id}`, {
        name: formData.name,
        displayName: formData.displayName || undefined,
        code: formData.code || undefined,
        entityTypes: ['Employee'],
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        status: formData.status,
        isActive: true,
        metadata: {
          employeeId: formData.metadata.employeeId || undefined,
          department: formData.metadata.department || undefined,
          title: formData.metadata.title || undefined,
          employmentType: formData.metadata.employmentType || undefined,
          startDate: formData.metadata.startDate || undefined,
        },
      });
      
      console.log('Employee updated successfully');
      toast.success('Employee updated successfully.');
      
      await fetchEmployees();
      setIsEditOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error updating employee:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update employee');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;
    
    try {
      if (!orgId) {
        toast.error('Organization not selected.');
        return;
      }

      await apiDelete(`/api/employees/${id}`);
      
      console.log('Employee deleted successfully');
      toast.success('Employee deleted successfully.');
      
      await fetchEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error('Failed to delete employee');
    }
  };

  const openEditDialog = (employee: Employee) => {
    setSelectedEmployee(employee);
    setFormData({
      name: employee.name,
      displayName: employee.displayName || '',
      code: employee.code || '',
      email: employee.email || '',
      phone: employee.phone || '',
      status: employee.status,
      metadata: {
        employeeId: employee.metadata?.employeeId || '',
        department: employee.metadata?.department || '',
        title: employee.metadata?.title || '',
        employmentType: employee.metadata?.employmentType || 'full-time',
        startDate: employee.metadata?.startDate || '',
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
      status: 'active',
      metadata: {
        employeeId: '',
        department: '',
        title: '',
        employmentType: 'full-time',
        startDate: '',
      }
    });
    setSelectedEmployee(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Employees</CardTitle>
              <CardDescription>Manage your employee directory</CardDescription>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Employee
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Employee</DialogTitle>
                  <DialogDescription>Add a new employee to your organization</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name*</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employeeId">Employee ID</Label>
                      <Input
                        id="employeeId"
                        value={formData.metadata.employeeId}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          metadata: { ...formData.metadata, employeeId: e.target.value }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="title">Job Title</Label>
                      <Input
                        id="title"
                        value={formData.metadata.title}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          metadata: { ...formData.metadata, title: e.target.value }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="department">Department</Label>
                      <Input
                        id="department"
                        value={formData.metadata.department}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          metadata: { ...formData.metadata, department: e.target.value }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employmentType">Employment Type</Label>
                      <Select
                        value={formData.metadata.employmentType}
                        onValueChange={(value) => setFormData({ 
                          ...formData, 
                          metadata: { ...formData.metadata, employmentType: value }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full-time">Full Time</SelectItem>
                          <SelectItem value="part-time">Part Time</SelectItem>
                          <SelectItem value="contractor">Contractor</SelectItem>
                          <SelectItem value="intern">Intern</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Start Date</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={formData.metadata.startDate}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          metadata: { ...formData.metadata, startDate: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                </div>
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
                <TableHead>Employee ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">
                    {employee.displayName || employee.name}
                  </TableCell>
                  <TableCell>{employee.metadata?.employeeId || employee.code || '-'}</TableCell>
                  <TableCell>{employee.metadata?.title || '-'}</TableCell>
                  <TableCell>{employee.metadata?.department || '-'}</TableCell>
                  <TableCell>{employee.email || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {employee.metadata?.employmentType || 'full-time'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={employee.status === 'active' ? 'default' : 'secondary'}>
                      {employee.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => router.push(`/relationships/employees/${employee.id}`)}
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">View</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => openEditDialog(employee)}
                        title="Edit employee"
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDelete(employee.id)}
                        title="Delete employee"
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
          
          {employees.length === 0 && (
            <div className="text-center py-10 text-gray-500">
              No employees found. Add your first employee to get started.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>Update employee information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name*</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-employeeId">Employee ID</Label>
                <Input
                  id="edit-employeeId"
                  value={formData.metadata.employeeId}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    metadata: { ...formData.metadata, employeeId: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-title">Job Title</Label>
                <Input
                  id="edit-title"
                  value={formData.metadata.title}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    metadata: { ...formData.metadata, title: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-department">Department</Label>
                <Input
                  id="edit-department"
                  value={formData.metadata.department}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    metadata: { ...formData.metadata, department: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-employmentType">Employment Type</Label>
                <Select
                  value={formData.metadata.employmentType}
                  onValueChange={(value) => setFormData({ 
                    ...formData, 
                    metadata: { ...formData.metadata, employmentType: value }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-time">Full Time</SelectItem>
                    <SelectItem value="part-time">Part Time</SelectItem>
                    <SelectItem value="contractor">Contractor</SelectItem>
                    <SelectItem value="intern">Intern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-startDate">Start Date</Label>
                <Input
                  id="edit-startDate"
                  type="date"
                  value={formData.metadata.startDate}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    metadata: { ...formData.metadata, startDate: e.target.value }
                  })}
                />
              </div>
            </div>
          </div>
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