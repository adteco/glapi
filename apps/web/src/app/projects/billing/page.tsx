"use client";

import { useMemo, useState } from "react";
import { ArrowRightLeft, FileCheck2, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-compat.client";
import { trpc } from "@/lib/trpc";
import type { RouterOutputs } from "@glapi/trpc";

type BillingInvoice = RouterOutputs["projectBilling"]["listInvoices"][number];
type TransitionAction = "void" | "release" | "transfer" | "rebill";

function formatMoney(value: string | number, currencyCode = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(Number(value));
}

function idempotencyKey(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export default function ProjectBillingPage() {
  const { orgId } = useAuth();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [dueDate, setDueDate] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [transition, setTransition] = useState<{
    invoice: BillingInvoice;
    action: TransitionAction;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [targetInvoiceId, setTargetInvoiceId] = useState("");

  const candidatesQuery = trpc.projectBilling.listCandidates.useQuery(
    { page: 1, limit: 100 },
    { enabled: !!orgId },
  );
  const draftQuery = trpc.projectBilling.listInvoices.useQuery(
    { status: "draft" },
    { enabled: !!orgId },
  );
  const billedQuery = trpc.projectBilling.listInvoices.useQuery(
    { status: "billed" },
    { enabled: !!orgId },
  );
  const previewQuery = trpc.projectBilling.previewInvoiceDrafts.useQuery(
    { candidateIds: selectedIds },
    { enabled: previewOpen && selectedIds.length > 0 },
  );

  const createMutation = trpc.projectBilling.createInvoiceDrafts.useMutation({
    onSuccess: (result) => {
      toast.success(
        `${result.invoices.length} project invoice draft(s) created`,
      );
      setPreviewOpen(false);
      setSelectedIds([]);
      void Promise.all([
        candidatesQuery.refetch(),
        draftQuery.refetch(),
        billedQuery.refetch(),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });
  const transitionMutation = trpc.projectBilling.transitionInvoice.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.replacementInvoiceId
          ? `Allocation lineage moved to replacement invoice`
          : `Project billing allocation ${result.action} completed`,
      );
      setTransition(null);
      setReason("");
      setTargetInvoiceId("");
      void Promise.all([
        candidatesQuery.refetch(),
        draftQuery.refetch(),
        billedQuery.refetch(),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  const candidates = useMemo(
    () => candidatesQuery.data?.data ?? [],
    [candidatesQuery.data?.data],
  );
  const readyIds = candidates
    .filter((candidate) => candidate.pricingStatus === "ready")
    .map((candidate) => candidate.candidateId);
  const selectedTotal = useMemo(
    () =>
      candidates
        .filter((candidate) => selectedIds.includes(candidate.candidateId))
        .reduce((sum, candidate) => sum + Number(candidate.amount ?? 0), 0),
    [candidates, selectedIds],
  );

  const submitTransition = () => {
    if (!transition || reason.trim().length < 3) return;
    transitionMutation.mutate({
      invoiceId: transition.invoice.invoiceId,
      action: transition.action,
      reason,
      targetInvoiceId:
        transition.action === "transfer" ? targetInvoiceId : undefined,
      invoiceDate: transition.action === "rebill" ? invoiceDate : undefined,
      dueDate: transition.action === "rebill" && dueDate ? dueDate : undefined,
      idempotencyKey: idempotencyKey(transition.action),
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Project billing queue
        </h1>
        <p className="text-muted-foreground">
          Turn approved project work into traceable invoice drafts.
        </p>
      </div>

      <Tabs defaultValue="ready" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ready">
            Ready ({candidatesQuery.data?.total ?? 0})
          </TabsTrigger>
          <TabsTrigger value="draft">
            Draft ({draftQuery.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="billed">
            Billed & history ({billedQuery.data?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ready">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Eligible project work</CardTitle>
                <CardDescription>
                  Only approved, unallocated sources can be selected.
                </CardDescription>
              </div>
              <Button
                disabled={!selectedIds.length}
                onClick={() => setPreviewOpen(true)}
              >
                Preview {selectedIds.length} selected ·{" "}
                {formatMoney(selectedTotal)}
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          readyIds.length > 0 &&
                          selectedIds.length === readyIds.length
                        }
                        onCheckedChange={(checked) =>
                          setSelectedIds(checked ? readyIds : [])
                        }
                        aria-label="Select all ready work"
                      />
                    </TableHead>
                    <TableHead>Customer / project</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Service date</TableHead>
                    <TableHead>Pricing</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((candidate) => (
                    <TableRow key={candidate.candidateId}>
                      <TableCell>
                        <Checkbox
                          disabled={candidate.pricingStatus !== "ready"}
                          checked={selectedIds.includes(candidate.candidateId)}
                          onCheckedChange={(checked) =>
                            setSelectedIds((current) =>
                              checked
                                ? [...current, candidate.candidateId]
                                : current.filter(
                                    (id) => id !== candidate.candidateId,
                                  ),
                            )
                          }
                          aria-label={`Select ${candidate.description}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {candidate.customerName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {candidate.projectCode} · {candidate.projectName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {candidate.sourceType.replace("PROJECT_", "")}
                        </Badge>
                        <div className="mt-1 max-w-72 truncate text-sm">
                          {candidate.description}
                        </div>
                      </TableCell>
                      <TableCell>{candidate.serviceDate}</TableCell>
                      <TableCell>
                        {candidate.pricingStatus === "ready" ? (
                          <Badge>Ready</Badge>
                        ) : (
                          <Badge variant="destructive">Missing rate</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {candidate.amount
                          ? formatMoney(
                              candidate.amount,
                              candidate.currencyCode,
                            )
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!candidatesQuery.isLoading && candidates.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-32 text-center text-muted-foreground"
                      >
                        No approved project work is waiting to bill.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="draft">
          <InvoiceHistory
            invoices={draftQuery.data ?? []}
            drafts={draftQuery.data ?? []}
            onTransition={(invoice, action) =>
              setTransition({ invoice, action })
            }
          />
        </TabsContent>
        <TabsContent value="billed">
          <InvoiceHistory
            invoices={billedQuery.data ?? []}
            drafts={draftQuery.data ?? []}
            onTransition={(invoice, action) =>
              setTransition({ invoice, action })
            }
          />
        </TabsContent>
      </Tabs>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Preview project invoice drafts</DialogTitle>
            <DialogDescription>
              Review grouping and totals before reserving the source
              allocations.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 space-y-3 overflow-auto">
            {previewQuery.data?.drafts.map((draft) => (
              <div key={draft.groupKey} className="rounded-lg border p-4">
                <div className="flex justify-between">
                  <div>
                    <div className="font-semibold">{draft.customerName}</div>
                    <div className="text-sm text-muted-foreground">
                      {draft.projectName ?? "Customer-level invoice"} ·{" "}
                      {draft.lineCount} line(s)
                    </div>
                  </div>
                  <div className="font-semibold">
                    {formatMoney(draft.subtotal, draft.currencyCode)}
                  </div>
                </div>
              </div>
            ))}
            {previewQuery.isLoading && (
              <p className="text-sm text-muted-foreground">
                Calculating invoice groups…
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="invoice-date">Invoice date</Label>
              <Input
                id="invoice-date"
                type="date"
                value={invoiceDate}
                onChange={(event) => setInvoiceDate(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="due-date">Due date</Label>
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!previewQuery.data || createMutation.isPending}
              onClick={() =>
                createMutation.mutate({
                  candidateIds: selectedIds,
                  invoiceDate,
                  dueDate: dueDate || undefined,
                  idempotencyKey: idempotencyKey("create"),
                })
              }
            >
              Create {previewQuery.data?.draftCount ?? 0} draft(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!transition}
        onOpenChange={(open) => !open && setTransition(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm {transition?.action}</DialogTitle>
            <DialogDescription>
              This changes allocation state but preserves the original invoice
              and source lineage for audit.
            </DialogDescription>
          </DialogHeader>
          {transition?.action === "transfer" && (
            <div>
              <Label htmlFor="target-invoice">Target draft invoice</Label>
              <Select
                value={targetInvoiceId}
                onValueChange={setTargetInvoiceId}
              >
                <SelectTrigger id="target-invoice">
                  <SelectValue placeholder="Choose a same-customer draft" />
                </SelectTrigger>
                <SelectContent>
                  {(draftQuery.data ?? [])
                    .filter(
                      (draft) =>
                        draft.invoiceId !== transition.invoice.invoiceId &&
                        draft.customerId === transition.invoice.customerId,
                    )
                    .map((draft) => (
                      <SelectItem key={draft.invoiceId} value={draft.invoiceId}>
                        {draft.invoiceNumber}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {transition?.action === "rebill" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="rebill-date">Replacement date</Label>
                <Input
                  id="rebill-date"
                  type="date"
                  value={invoiceDate}
                  onChange={(event) => setInvoiceDate(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="rebill-due-date">Due date</Label>
                <Input
                  id="rebill-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </div>
            </div>
          )}
          <div>
            <Label htmlFor="transition-reason">Audit reason</Label>
            <Textarea
              id="transition-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why this destructive transition is required"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransition(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                reason.trim().length < 3 ||
                (transition?.action === "transfer" && !targetInvoiceId) ||
                transitionMutation.isPending
              }
              onClick={submitTransition}
            >
              Confirm {transition?.action}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InvoiceHistory({
  invoices,
  drafts,
  onTransition,
}: {
  invoices: BillingInvoice[];
  drafts: BillingInvoice[];
  onTransition: (invoice: BillingInvoice, action: TransitionAction) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Project invoice allocation history</CardTitle>
        <CardDescription>
          Allocation state and replacement links remain visible after every
          transition.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Allocation lineage</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.invoiceId}>
                <TableCell>
                  <div className="font-medium">{invoice.invoiceNumber}</div>
                  <div className="text-sm text-muted-foreground">
                    {invoice.invoiceDate}
                  </div>
                </TableCell>
                <TableCell>{invoice.customerName}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      invoice.invoiceStatus === "void"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {invoice.invoiceStatus}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {invoice.allocations.map((allocation) => (
                      <Badge
                        key={allocation.id}
                        variant="outline"
                        title={
                          allocation.replacedByAllocationId
                            ? `Replaced by ${allocation.replacedByAllocationId}`
                            : allocation.id
                        }
                      >
                        {allocation.sourceType.replace("PROJECT_", "")}:{" "}
                        {allocation.status}
                        {allocation.replacedByAllocationId
                          ? " → replacement"
                          : ""}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatMoney(
                    invoice.totalAmount,
                    invoice.allocations[0]?.currencyCode,
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Release allocations"
                      onClick={() => onTransition(invoice, "release")}
                    >
                      <FileCheck2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Transfer to another draft"
                      disabled={
                        !drafts.some(
                          (draft) =>
                            draft.invoiceId !== invoice.invoiceId &&
                            draft.customerId === invoice.customerId,
                        )
                      }
                      onClick={() => onTransition(invoice, "transfer")}
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Void and rebill"
                      onClick={() => onTransition(invoice, "rebill")}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Void invoice"
                      onClick={() => onTransition(invoice, "void")}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!invoices.length && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-32 text-center text-muted-foreground"
                >
                  No project invoices in this view.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
