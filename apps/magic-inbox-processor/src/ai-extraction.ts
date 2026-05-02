import type {
  DocumentType,
  EmailAttachment,
  ExtractedInvoiceData,
  ProcessorConfig,
} from './types';

export interface InvoiceExtractionInput {
  subject: string;
  bodyText?: string;
  sender: string;
  senderName?: string;
  attachments: EmailAttachment[];
}

export interface InvoiceExtractionResult {
  documentType: DocumentType;
  confidence: number;
  summary?: string;
  extractedInvoice?: ExtractedInvoiceData;
  metadata?: Record<string, unknown>;
}

export interface InvoiceExtractionProvider {
  extract(input: InvoiceExtractionInput): Promise<InvoiceExtractionResult | null>;
}

export function createInvoiceExtractionProvider(config: ProcessorConfig): InvoiceExtractionProvider {
  if (config.enableAiExtraction && config.aiExtractionProvider === 'bedrock') {
    return new BedrockInvoiceExtractionProvider(config);
  }

  return new HeuristicInvoiceExtractionProvider();
}

class BedrockInvoiceExtractionProvider implements InvoiceExtractionProvider {
  constructor(private readonly config: ProcessorConfig) {}

  async extract(input: InvoiceExtractionInput): Promise<InvoiceExtractionResult | null> {
    const fallback = await new HeuristicInvoiceExtractionProvider().extract(input);

    if (!fallback) {
      return null;
    }

    return {
      ...fallback,
      metadata: {
        ...fallback?.metadata,
        aiProvider: 'bedrock',
        bedrockModelId: this.config.bedrockModelId,
        bedrockMode: 'adapter_ready_pending_runtime_client',
      },
    };
  }
}

class HeuristicInvoiceExtractionProvider implements InvoiceExtractionProvider {
  async extract(input: InvoiceExtractionInput): Promise<InvoiceExtractionResult | null> {
    const text = [input.subject, input.bodyText].filter(Boolean).join('\n');
    const invoiceNumber = this.matchFirst(text, [
      /invoice\s*(?:number|#|no\.?)\s*:?\s*([a-z0-9-]+)/i,
      /\binv[-\s#:]?([a-z0-9-]+)/i,
    ]);
    const totalAmount = this.matchAmount(text);
    const invoiceDate = this.matchDate(text, /(?:invoice|bill)\s*date\s*:?\s*([0-9/.-]+)/i);
    const dueDate = this.matchDate(text, /due\s*date\s*:?\s*([0-9/.-]+)/i);

    const looksLikeInvoice =
      /invoice|vendor bill|amount due|balance due|remit/i.test(text) ||
      input.attachments.some((attachment) => /invoice|bill/i.test(attachment.filename));

    if (!looksLikeInvoice) {
      return null;
    }

    return {
      documentType: 'invoice',
      confidence: totalAmount || invoiceNumber ? 0.75 : 0.6,
      summary: totalAmount
        ? `Invoice received for ${totalAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}.`
        : 'Invoice received for review.',
      extractedInvoice: {
        vendorName: input.senderName,
        vendorEmail: input.sender,
        invoiceNumber,
        invoiceDate,
        dueDate,
        totalAmount,
        currency: 'USD',
        confidence: totalAmount || invoiceNumber ? 0.75 : 0.6,
      },
      metadata: {
        aiProvider: 'heuristic',
      },
    };
  }

  private matchFirst(text: string, patterns: RegExp[]): string | undefined {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }

    return undefined;
  }

  private matchAmount(text: string): number | undefined {
    const match = text.match(/(?:total|amount due|balance due)\s*:?\s*\$?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (!match?.[1]) {
      return undefined;
    }

    const amount = Number(match[1].replace(/,/g, ''));
    return Number.isFinite(amount) ? amount : undefined;
  }

  private matchDate(text: string, pattern: RegExp): string | undefined {
    const match = text.match(pattern);
    if (!match?.[1]) {
      return undefined;
    }

    const date = new Date(match[1]);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString().split('T')[0];
  }
}
