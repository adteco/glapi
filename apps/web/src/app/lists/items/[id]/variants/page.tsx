'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, X, Package, ArrowLeft } from 'lucide-react';

interface Item {
  id: string;
  itemCode: string;
  name: string;
  description?: string | null;
  isParent: boolean;
  isActive?: boolean;
  variantAttributes?: any;
}

interface VariantAttribute {
  name: string;
  values: string[];
}

export default function ItemVariantsPage() {
  const router = useRouter();
  const params = useParams();
  const { getToken, orgId } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [parentItem, setParentItem] = useState<Item | null>(null);
  const [variants, setVariants] = useState<Item[]>([]);
  const [attributes, setAttributes] = useState<VariantAttribute[]>([]);
  const [newAttributeName, setNewAttributeName] = useState('');
  const [newAttributeValue, setNewAttributeValue] = useState('');
  const [selectedAttribute, setSelectedAttribute] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const itemId = params.id as string;

  useEffect(() => {
    if (itemId) {
      fetchItemAndVariants();
    }
  }, [itemId]);

  const fetchItemAndVariants = async () => {
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Authentication token not available.');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      
      // Fetch parent item
      const itemResponse = await fetch(`${apiUrl}/api/items/${itemId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!itemResponse.ok) {
        toast.error('Failed to fetch item');
        router.push('/lists/items');
        return;
      }

      const item = await itemResponse.json();
      setParentItem(item);

      // Load existing variant attributes if any
      if (item.variantAttributes) {
        const attrs: VariantAttribute[] = [];
        for (const [name, values] of Object.entries(item.variantAttributes)) {
          attrs.push({ name, values: values as string[] });
        }
        setAttributes(attrs);
      }

      // Fetch existing variants
      const variantsResponse = await fetch(`${apiUrl}/api/items/${itemId}/variants`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (variantsResponse.ok) {
        const variantsData = await variantsResponse.json();
        setVariants(variantsData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const addAttribute = () => {
    if (!newAttributeName.trim()) {
      toast.error('Attribute name is required');
      return;
    }

    if (attributes.some(attr => attr.name.toLowerCase() === newAttributeName.toLowerCase())) {
      toast.error('Attribute already exists');
      return;
    }

    setAttributes([...attributes, { name: newAttributeName, values: [] }]);
    setNewAttributeName('');
    setSelectedAttribute(attributes.length);
  };

  const removeAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index));
    if (selectedAttribute === index) {
      setSelectedAttribute(null);
    }
  };

  const addAttributeValue = () => {
    if (selectedAttribute === null) {
      toast.error('Select an attribute first');
      return;
    }

    if (!newAttributeValue.trim()) {
      toast.error('Value is required');
      return;
    }

    const attr = attributes[selectedAttribute];
    if (attr.values.includes(newAttributeValue)) {
      toast.error('Value already exists');
      return;
    }

    const newAttributes = [...attributes];
    newAttributes[selectedAttribute].values.push(newAttributeValue);
    setAttributes(newAttributes);
    setNewAttributeValue('');
  };

  const removeAttributeValue = (attrIndex: number, valueIndex: number) => {
    const newAttributes = [...attributes];
    newAttributes[attrIndex].values.splice(valueIndex, 1);
    setAttributes(newAttributes);
  };

  const calculateVariantCount = () => {
    if (attributes.length === 0) return 0;
    return attributes.reduce((total, attr) => total * (attr.values.length || 1), 1);
  };

  const generateVariants = async () => {
    if (attributes.length === 0) {
      toast.error('Add at least one attribute with values');
      return;
    }

    const hasEmptyValues = attributes.some(attr => attr.values.length === 0);
    if (hasEmptyValues) {
      toast.error('All attributes must have at least one value');
      return;
    }

    const variantCount = calculateVariantCount();
    if (variantCount > 100) {
      if (!confirm(`This will create ${variantCount} variants. Are you sure you want to continue?`)) {
        return;
      }
    }

    setIsGenerating(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Authentication token not available.');
        return;
      }

      // Convert attributes to object format
      const attributesObject: Record<string, string[]> = {};
      attributes.forEach(attr => {
        attributesObject[attr.name] = attr.values;
      });

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/items/${itemId}/variants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          attributes: attributesObject,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || 'Failed to generate variants');
        return;
      }

      const newVariants = await response.json();
      toast.success(`Successfully generated ${newVariants.length} variants`);
      setVariants(newVariants);
      
      // Update parent item to be marked as parent
      if (!parentItem?.isParent) {
        await fetch(`${apiUrl}/api/items/${itemId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            isParent: true,
            variantAttributes: attributesObject,
          }),
        });
      }
    } catch (error) {
      console.error('Error generating variants:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return <div className="container mx-auto py-10"><p>Loading...</p></div>;
  }

  if (!parentItem) {
    return <div className="container mx-auto py-10"><p>Item not found</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/lists/items')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Items
        </Button>
        
        <h1 className="text-3xl font-bold">Manage Variants</h1>
        <p className="text-muted-foreground mt-2">
          Parent Item: {parentItem.name} ({parentItem.itemCode})
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Variant Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Variant Configuration</CardTitle>
            <CardDescription>
              Define attributes and their values to generate variants
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add Attribute */}
            <div className="flex gap-2">
              <Input
                placeholder="Attribute name (e.g., Size, Color)"
                value={newAttributeName}
                onChange={(e) => setNewAttributeName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addAttribute()}
              />
              <Button onClick={addAttribute}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Attributes List */}
            <div className="space-y-2">
              {attributes.map((attr, index) => (
                <div
                  key={index}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedAttribute === index ? 'border-primary bg-primary/5' : 'hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedAttribute(index)}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">{attr.name}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAttribute(index);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {attr.values.map((value, valueIndex) => (
                      <Badge
                        key={valueIndex}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAttributeValue(index, valueIndex);
                        }}
                      >
                        {value} <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                    {attr.values.length === 0 && (
                      <span className="text-sm text-muted-foreground">No values yet</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add Value */}
            {selectedAttribute !== null && (
              <div className="flex gap-2">
                <Input
                  placeholder={`Add value for ${attributes[selectedAttribute].name}`}
                  value={newAttributeValue}
                  onChange={(e) => setNewAttributeValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addAttributeValue()}
                />
                <Button onClick={addAttributeValue} size="sm">
                  Add Value
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              {calculateVariantCount() > 0
                ? `${calculateVariantCount()} variants will be generated`
                : 'Configure attributes to see preview'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {attributes.length > 0 && calculateVariantCount() > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium mb-3">Sample variant codes:</p>
                {(() => {
                  const samples: string[] = [];
                  const generateCombinations = (attrIndex: number, current: string[]): void => {
                    if (samples.length >= 5) return;
                    
                    if (attrIndex === attributes.length) {
                      samples.push(`${parentItem.itemCode}-${current.join('-')}`);
                      return;
                    }
                    
                    for (const value of attributes[attrIndex].values) {
                      generateCombinations(attrIndex + 1, [...current, value]);
                      if (samples.length >= 5) return;
                    }
                  };
                  
                  generateCombinations(0, []);
                  
                  return samples.map((code, index) => (
                    <div key={index} className="text-sm font-mono bg-gray-50 p-2 rounded">
                      {code}
                    </div>
                  ));
                })()}
                {calculateVariantCount() > 5 && (
                  <p className="text-sm text-muted-foreground">
                    ... and {calculateVariantCount() - 5} more
                  </p>
                )}
              </div>
            )}
            
            <Button
              className="w-full mt-4"
              onClick={generateVariants}
              disabled={calculateVariantCount() === 0 || isGenerating}
            >
              {isGenerating ? (
                'Generating...'
              ) : (
                <>
                  <Package className="mr-2 h-4 w-4" />
                  Generate {calculateVariantCount()} Variants
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Existing Variants */}
      {variants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Existing Variants</CardTitle>
            <CardDescription>
              {variants.length} variants have been created
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableCaption>All variants for this parent item</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Attributes</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variants.map((variant) => (
                  <TableRow key={variant.id}>
                    <TableCell className="font-medium">{variant.itemCode}</TableCell>
                    <TableCell>{variant.name}</TableCell>
                    <TableCell>
                      {variant.variantAttributes && (
                        <div className="flex gap-1">
                          {Object.entries(variant.variantAttributes).map(([key, value]) => (
                            <Badge key={key} variant="outline">
                              {key}: {String(value)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {variant.isActive ? '✓' : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}