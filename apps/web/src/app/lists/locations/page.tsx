'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// Define interfaces
interface Location {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  organizationId: string;
  subsidiaryId: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  subsidiary?: {
    id: string;
    name: string;
  };
}

interface Subsidiary {
  id: string;
  name: string;
  code?: string;
}

// Form schema
const locationFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  code: z.string().max(50).optional().or(z.literal('')),
  description: z.string().max(1000).optional().or(z.literal('')),
  subsidiaryId: z.string().min(1, "Subsidiary is required"),
  addressLine1: z.string().max(255).optional().or(z.literal('')),
  addressLine2: z.string().max(255).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  stateProvince: z.string().max(100).optional().or(z.literal('')),
  postalCode: z.string().max(20).optional().or(z.literal('')),
  countryCode: z.string().length(2).optional().or(z.literal('')),
});

type LocationFormValues = z.infer<typeof locationFormSchema>;

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { getToken, orgId } = useAuth();

  const form = useForm<LocationFormValues>({
    // resolver: zodResolver(locationFormSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      subsidiaryId: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      stateProvince: "",
      postalCode: "",
      countryCode: "",
    },
  });

  // Fetch locations
  useEffect(() => {
    const fetchLocations = async () => {
      if (!orgId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const token = await getToken();
        if (!token) {
          toast.error('Authentication token not available.');
          setIsLoading(false);
          return;
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/locations`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorResult = await response.json();
          toast.error(errorResult.message || errorResult.error || 'Failed to fetch locations.');
          throw new Error('Failed to fetch locations');
        }

        const data = await response.json();
        setLocations(data.data || []);
      } catch (error) {
        console.error('Error fetching locations:', error);
        if (!(error instanceof Error && error.message === 'Failed to fetch locations')) {
          toast.error('An unexpected error occurred while fetching locations.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchLocations();
  }, [orgId, getToken]);

  // Fetch subsidiaries
  useEffect(() => {
    const fetchSubsidiaries = async () => {
      if (!orgId) return;
      
      try {
        const token = await getToken();
        if (!token) return;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/subsidiaries`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.error('Failed to fetch subsidiaries');
          return;
        }

        const data = await response.json();
        setSubsidiaries(data.data || []);
      } catch (error) {
        console.error('Error fetching subsidiaries:', error);
      }
    };

    fetchSubsidiaries();
  }, [orgId, getToken]);

  // Handle form submission
  const onSubmit = async (values: LocationFormValues) => {
    if (!orgId) {
      toast.error('Organization not selected.');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Authentication token not available.');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/locations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: values.name,
          code: values.code || undefined,
          description: values.description || undefined,
          subsidiaryId: values.subsidiaryId,
          addressLine1: values.addressLine1 || undefined,
          addressLine2: values.addressLine2 || undefined,
          city: values.city || undefined,
          stateProvince: values.stateProvince || undefined,
          postalCode: values.postalCode || undefined,
          countryCode: values.countryCode || undefined,
        }),
      });

      if (!response.ok) {
        const errorResult = await response.json();
        toast.error(errorResult.message || 'Failed to create location.');
        throw new Error('Failed to create location');
      }

      const result = await response.json();
      
      toast.success('Location created successfully!');
      setIsDialogOpen(false);
      form.reset();
      
      // Refresh the locations list
      const refreshResponse = await fetch(`${apiUrl}/api/locations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        setLocations(data.data || []);
      }
    } catch (error) {
      console.error('Error creating location:', error);
      if (!(error instanceof Error && error.message === 'Failed to create location')) {
        toast.error('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format address for display
  const formatAddress = (location: Location) => {
    const parts = [
      location.addressLine1,
      location.addressLine2,
      location.city,
      location.stateProvince,
      location.postalCode,
      location.countryCode,
    ].filter(Boolean);
    
    return parts.length > 0 ? parts.join(', ') : '-';
  };

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Locations</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Location
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[625px]">
            <DialogHeader>
              <DialogTitle>Create New Location</DialogTitle>
              <DialogDescription>
                Add a new location to your organization. Locations help track where transactions occur.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Main Office" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Code (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="HQ-001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Corporate headquarters" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="subsidiaryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subsidiary</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a subsidiary" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {subsidiaries.map((subsidiary) => (
                            <SelectItem key={subsidiary.id} value={subsidiary.id}>
                              {subsidiary.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        The subsidiary this location belongs to.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Address (Optional)</h3>
                  
                  <FormField
                    control={form.control}
                    name="addressLine1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address Line 1</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main Street" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="addressLine2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address Line 2</FormLabel>
                        <FormControl>
                          <Input placeholder="Suite 100" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="San Francisco" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="stateProvince"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State/Province</FormLabel>
                          <FormControl>
                            <Input placeholder="CA" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="postalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Postal Code</FormLabel>
                          <FormControl>
                            <Input placeholder="94105" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="countryCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country Code</FormLabel>
                          <FormControl>
                            <Input placeholder="US" maxLength={2} {...field} />
                          </FormControl>
                          <FormDescription>
                            2-letter ISO country code
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      form.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create Location'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-10">Loading locations...</div>
      ) : locations.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-muted-foreground mb-4">No locations found. Create your first location to get started.</p>
        </div>
      ) : (
        <Table>
          <TableCaption>A list of all locations in your organization.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Subsidiary</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.map((location) => (
              <TableRow key={location.id}>
                <TableCell className="font-medium">{location.name}</TableCell>
                <TableCell>{location.code || '-'}</TableCell>
                <TableCell>{location.description || '-'}</TableCell>
                <TableCell className="max-w-xs truncate">{formatAddress(location)}</TableCell>
                <TableCell>{location.subsidiary?.name || '-'}</TableCell>
                <TableCell>
                  <Badge variant={location.isActive ? 'default' : 'secondary'}>
                    {location.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(location.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}