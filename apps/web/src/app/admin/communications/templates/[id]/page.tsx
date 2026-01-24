'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import {
  ArrowLeft,
  Save,
  Eye,
  Code,
  Settings,
  Variable,
  Plus,
  Trash2,
  Play,
  Check,
  Archive,
  FileEdit,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { cn } from '@/lib/utils';

const variableSchema = z.object({
  key: z.string().min(1, 'Key is required').max(50),
  label: z.string().min(1, 'Label is required').max(100),
  type: z.enum(['string', 'number', 'date', 'boolean', 'currency', 'url', 'email']),
  required: z.boolean(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  description: z.string().max(500).optional(),
});

const templateFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(1000).optional(),
  category: z.enum([
    'transactional',
    'marketing',
    'notification',
    'workflow',
    'custom',
  ]),
  subject: z.string().min(1, 'Subject is required').max(500),
  htmlBody: z.string().min(1, 'HTML body is required'),
  textBody: z.string().optional(),
  variables: z.array(variableSchema).optional().default([]),
  fromName: z.string().max(255).optional(),
  fromEmail: z.string().email().max(255).optional().or(z.literal('')),
  replyTo: z.string().email().max(255).optional().or(z.literal('')),
});

type TemplateFormValues = z.infer<typeof templateFormSchema>;

const CATEGORY_OPTIONS = [
  { value: 'transactional', label: 'Transactional' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'notification', label: 'Notification' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'custom', label: 'Custom' },
];

const VARIABLE_TYPE_OPTIONS = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'currency', label: 'Currency' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
];

export default function TemplateEditorPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNew = params.id === 'new';
  const showPreview = searchParams.get('preview') === 'true';

  const [activeTab, setActiveTab] = useState<'html' | 'text' | 'preview'>(
    showPreview ? 'preview' : 'html'
  );
  const [previewData, setPreviewData] = useState<Record<string, unknown>>({});
  const [showStatusDialog, setShowStatusDialog] = useState<
    'activate' | 'archive' | null
  >(null);

  const utils = trpc.useUtils();

  const { data: template, isLoading } = trpc.emailTemplates.get.useQuery(
    { id: params.id as string },
    { enabled: !isNew }
  );

  const createMutation = trpc.emailTemplates.create.useMutation({
    onSuccess: (data) => {
      toast.success('Template created');
      router.push(`/admin/communications/templates/${data.id}`);
    },
    onError: (error) => {
      toast.error(`Failed to create template: ${error.message}`);
    },
  });

  const updateMutation = trpc.emailTemplates.update.useMutation({
    onSuccess: () => {
      toast.success('Template saved');
      utils.emailTemplates.get.invalidate({ id: params.id as string });
    },
    onError: (error) => {
      toast.error(`Failed to save template: ${error.message}`);
    },
  });

  const updateStatusMutation = trpc.emailTemplates.updateStatus.useMutation({
    onSuccess: () => {
      toast.success('Template status updated');
      utils.emailTemplates.get.invalidate({ id: params.id as string });
      setShowStatusDialog(null);
    },
    onError: (error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });

  const previewMutation = trpc.emailTemplates.preview.useMutation();

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      category: 'custom',
      subject: '',
      htmlBody: getDefaultHtmlTemplate(),
      textBody: '',
      variables: [],
      fromName: '',
      fromEmail: '',
      replyTo: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'variables',
  });

  // Reset form when template loads
  useEffect(() => {
    if (template && !isNew) {
      form.reset({
        name: template.name,
        slug: template.slug,
        description: template.description ?? '',
        category: template.category,
        subject: template.subject,
        htmlBody: template.htmlBody,
        textBody: template.textBody ?? '',
        variables: (template.variables as TemplateFormValues['variables']) ?? [],
        fromName: template.fromName ?? '',
        fromEmail: template.fromEmail ?? '',
        replyTo: template.replyTo ?? '',
      });
      setPreviewData((template.previewData as Record<string, unknown>) ?? {});
    }
  }, [template, isNew, form]);

  const handleSubmit = useCallback(
    (values: TemplateFormValues) => {
      const data = {
        ...values,
        fromEmail: values.fromEmail || undefined,
        replyTo: values.replyTo || undefined,
      };

      if (isNew) {
        createMutation.mutate({
          ...data,
          status: 'draft',
          previewData,
        });
      } else {
        updateMutation.mutate({
          id: params.id as string,
          data: {
            ...data,
            previewData,
          },
        });
      }
    },
    [isNew, params.id, previewData, createMutation, updateMutation]
  );

  const handlePreview = useCallback(() => {
    const values = form.getValues();
    previewMutation.mutate({
      subject: values.subject,
      htmlBody: values.htmlBody,
      textBody: values.textBody || undefined,
      variables: previewData,
    });
    setActiveTab('preview');
  }, [form, previewData, previewMutation]);

  const handleExtractVariables = useCallback(() => {
    const values = form.getValues();
    const content = `${values.subject} ${values.htmlBody} ${values.textBody || ''}`;
    const regex = /\{\{([^}]+)\}\}/g;
    const found = new Set<string>();
    let match;
    while ((match = regex.exec(content)) !== null) {
      found.add(match[1].trim());
    }

    const existingKeys = new Set(fields.map((f) => f.key));
    const newVariables = Array.from(found).filter((key) => !existingKeys.has(key));

    newVariables.forEach((key) => {
      append({
        key,
        label: key
          .split(/[_-]/)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
        type: 'string',
        required: true,
      });
    });

    if (newVariables.length > 0) {
      toast.success(`Found ${newVariables.length} new variable(s)`);
    } else {
      toast.info('No new variables found');
    }
  }, [form, fields, append]);

  const generateSlug = useCallback((name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100);
  }, []);

  if (!isNew && isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Skeleton className="h-[600px]" />
          </div>
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/communications/templates">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">
              {isNew ? 'New Template' : template?.name}
            </h1>
            {!isNew && template && (
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant={
                    template.status === 'active'
                      ? 'default'
                      : template.status === 'draft'
                        ? 'secondary'
                        : 'outline'
                  }
                >
                  {template.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {template.slug}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && template && (
            <>
              {template.status === 'draft' && (
                <Button
                  variant="outline"
                  onClick={() => setShowStatusDialog('activate')}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Activate
                </Button>
              )}
              {template.status === 'active' && (
                <Button
                  variant="outline"
                  onClick={() => setShowStatusDialog('archive')}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </Button>
              )}
              {template.status === 'archived' && (
                <Button
                  variant="outline"
                  onClick={() => setShowStatusDialog('activate')}
                >
                  <FileEdit className="mr-2 h-4 w-4" />
                  Reactivate
                </Button>
              )}
            </>
          )}
          <Button onClick={handlePreview} variant="outline">
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Button>
          <Button
            onClick={form.handleSubmit(handleSubmit)}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {createMutation.isPending || updateMutation.isPending
              ? 'Saving...'
              : 'Save'}
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Editor */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                if (isNew && !form.getValues('slug')) {
                                  form.setValue('slug', generateSlug(e.target.value));
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="slug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Slug</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormDescription>
                            Unique identifier for API use
                          </FormDescription>
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
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Brief description of this template"
                            rows={2}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CATEGORY_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subject Line</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Email subject with {{variables}}"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Content Editor */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Content</CardTitle>
                    <Tabs
                      value={activeTab}
                      onValueChange={(v) => setActiveTab(v as typeof activeTab)}
                    >
                      <TabsList>
                        <TabsTrigger value="html">
                          <Code className="mr-2 h-4 w-4" />
                          HTML
                        </TabsTrigger>
                        <TabsTrigger value="text">Text</TabsTrigger>
                        <TabsTrigger value="preview">
                          <Eye className="mr-2 h-4 w-4" />
                          Preview
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </CardHeader>
                <CardContent>
                  {activeTab === 'html' && (
                    <FormField
                      control={form.control}
                      name="htmlBody"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Enter HTML email body..."
                              rows={20}
                              className="font-mono text-sm bg-zinc-900 text-zinc-100 border-zinc-700"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {activeTab === 'text' && (
                    <FormField
                      control={form.control}
                      name="textBody"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Plain text version of the email"
                              rows={16}
                              className="font-mono"
                            />
                          </FormControl>
                          <FormDescription>
                            Optional plain text version for email clients that don&apos;t
                            support HTML
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {activeTab === 'preview' && (
                    <div className="border rounded-md">
                      {previewMutation.isPending ? (
                        <div className="h-[400px] flex items-center justify-center">
                          <div className="text-muted-foreground">
                            Generating preview...
                          </div>
                        </div>
                      ) : previewMutation.data ? (
                        <div className="h-[400px] overflow-auto">
                          <div className="border-b p-4 bg-muted">
                            <p className="text-sm">
                              <strong>Subject:</strong>{' '}
                              {previewMutation.data.subject}
                            </p>
                          </div>
                          <iframe
                            srcDoc={previewMutation.data.htmlBody}
                            className="w-full h-[350px]"
                            title="Email Preview"
                            sandbox=""
                          />
                        </div>
                      ) : (
                        <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                          Click &quot;Preview&quot; to see rendered template
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Variables */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Variable className="h-4 w-4" />
                      Variables
                    </CardTitle>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleExtractVariables}
                    >
                      <Play className="mr-2 h-3 w-3" />
                      Extract
                    </Button>
                  </div>
                  <CardDescription>
                    Define template variables like {'{{customer_name}}'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {fields.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No variables defined. Click &quot;Extract&quot; to find variables in
                      your template.
                    </p>
                  ) : (
                    fields.map((field, index) => (
                      <div
                        key={field.id}
                        className="flex items-start gap-2 p-3 border rounded-md"
                      >
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <code className="text-sm bg-muted px-2 py-0.5 rounded">
                              {'{{'}{field.key}{'}}'}
                            </code>
                            <Badge variant="outline" className="text-xs">
                              {field.type}
                            </Badge>
                            {field.required && (
                              <Badge variant="secondary" className="text-xs">
                                Required
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {field.label}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    ))
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      append({
                        key: '',
                        label: '',
                        type: 'string',
                        required: false,
                      })
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Variable
                  </Button>
                </CardContent>
              </Card>

              {/* Preview Data */}
              <Card>
                <CardHeader>
                  <CardTitle>Preview Data</CardTitle>
                  <CardDescription>
                    Sample data for previewing the template
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {fields.map((field) => (
                    <div key={field.id} className="space-y-1">
                      <Label className="text-sm">{field.label}</Label>
                      <Input
                        value={(previewData[field.key] as string) ?? ''}
                        onChange={(e) =>
                          setPreviewData((prev) => ({
                            ...prev,
                            [field.key]: e.target.value,
                          }))
                        }
                        placeholder={`Sample ${field.key}`}
                      />
                    </div>
                  ))}
                  {fields.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Add variables to set preview data
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Sender Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Sender Settings
                  </CardTitle>
                  <CardDescription>
                    Optional sender overrides for this template
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="fromName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>From Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Company Name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fromEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>From Email</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            placeholder="noreply@company.com"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="replyTo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reply To</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            placeholder="support@company.com"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </Form>

      {/* Status Change Dialog */}
      <AlertDialog
        open={!!showStatusDialog}
        onOpenChange={(open) => !open && setShowStatusDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {showStatusDialog === 'activate'
                ? 'Activate Template'
                : 'Archive Template'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {showStatusDialog === 'activate'
                ? 'This will make the template available for use in workflows and communications.'
                : 'This will hide the template from active use. It can be reactivated later.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                updateStatusMutation.mutate({
                  id: params.id as string,
                  status: showStatusDialog === 'activate' ? 'active' : 'archived',
                })
              }
            >
              {updateStatusMutation.isPending
                ? 'Updating...'
                : showStatusDialog === 'activate'
                  ? 'Activate'
                  : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function getDefaultHtmlTemplate(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      text-align: center;
      padding: 20px 0;
      border-bottom: 1px solid #eee;
    }
    .content {
      padding: 30px 0;
    }
    .footer {
      text-align: center;
      padding: 20px 0;
      border-top: 1px solid #eee;
      font-size: 12px;
      color: #666;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #0066cc;
      color: white;
      text-decoration: none;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Your Company</h1>
  </div>

  <div class="content">
    <p>Hello {{recipient_name}},</p>

    <p>Your email content goes here.</p>

    <p>
      <a href="{{action_url}}" class="button">Take Action</a>
    </p>
  </div>

  <div class="footer">
    <p>&copy; {{year}} Your Company. All rights reserved.</p>
    <p>
      <a href="{{unsubscribe_url}}">Unsubscribe</a>
    </p>
  </div>
</body>
</html>`;
}
