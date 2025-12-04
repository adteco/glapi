# Skill: Autonomous SOW Agent (Anthropic)

This Claude Code skill describes how we implemented the Statement of Work (SOW) Assistant so it can be replicated in other applications.

---

## Summary

The SOW Assistant is an Anthropic Claude “autonomous agent” wired into our Next.js surface. It:

1. Streams Anthropic responses over Server-Sent Events (SSE).
2. Invokes database-backed tools (read SOW, create items/criteria/tests).
3. Persists chat sessions and supports change previews the user can apply back to the SOW.
4. Lives inline inside the SOW page so users can switch tabs while chatting.

---

## Prerequisites & Libraries

| Concern | Library / API | Notes |
| --- | --- | --- |
| AI SDK | `@anthropic-ai/sdk` | Used inside `packages/ai-agent`. Requires `ANTHROPIC_API_KEY`. |
| HTTP Runtime | Next.js App Router | API route: `app/api/ai/agent/route.ts`. |
| Streaming | Native `ReadableStream` + SSE | API emits `text/event-stream` messages. |
| Database | Drizzle ORM + Supabase/Postgres | All CRUD lives in `packages/database`. |
| Auth | Clerk | API receives `userId` from the caller. |
| Validation | `zod` + `zod-to-json-schema` | Tool input schemas shared with Anthropic. |
| Frontend | React + custom hook (`use-ai-agent-stream`) | Handles SSE parsing, state, cancel/reset. |

Environment:

```bash
cp .env.local.example .env.local
# add: ANTHROPIC_API_KEY=<key>
pnpm install
pnpm dev    # or pnpm dev:all when MCP server required
```

Be sure migrations `packages/database/drizzle/0009_fix_criterion_acceptance_criteria.sql`,
`0010_fix_tests_additional_fields.sql`, and `0011_add_rfc_chat_history.sql` are applied (`pnpm --filter @tanda/database db:migrate`).

---

## File Map

```
apps/web/
  app/api/ai/agent/route.ts           # SSE endpoint shared by SOW + RFC
  app/api/sow/[sowId]/chat-history/route.ts
  app/api/sow/[sowId]/chat-sessions/route.ts
  app/api/rfc/[rfcId]/chat-history/route.ts
  app/api/rfc/[rfcId]/chat-sessions/route.ts
  hooks/use-ai-agent-stream.ts        # Streaming hook
  components/dashboard/sow/sow-chat-dialog.tsx
  app/(protected)/sows/[id]/sow-interface.tsx
  components/rfcs/rfc-chat-panel.tsx
  app/(protected)/rfcs/[rfcId]/page.tsx

packages/ai-agent/
  src/agent.ts                        # executeAgent / executeAgentStream
  src/agent-tools.ts                  # Tool definitions (SOW + RFC)

packages/database/
  schema/{items,criterion,tests}.ts
  schema/rfc_chat_history.ts
  functions/{items,criterion,tests}.ts
  functions/rfcChatHistory.ts
  drizzle/0009_fix_criterion_acceptance_criteria.sql
  drizzle/0010_fix_tests_additional_fields.sql
  drizzle/0011_add_rfc_chat_history.sql
```

---

## Step-by-Step Implementation

### 1. API Route with SSE (`apps/web/app/api/ai/agent/route.ts`)

```ts
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { query, sowId, userId = 'user-placeholder', stream = false } = body;
  const agentRequest = { prompt: query, sowId, userId };
  const agentConfig = { apiKey: process.env.ANTHROPIC_API_KEY!, streaming: stream };

  if (stream) {
    const encoder = new TextEncoder();
    const responseStream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'metadata', sowId, userId })}\n\n`));
        for await (const chunk of executeAgentStream(agentRequest, agentConfig)) {
          controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
        controller.close();
      },
    });
    return new Response(responseStream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  }

  const result = await executeAgent(agentRequest, agentConfig);
  return NextResponse.json(result);
}
```

Key points:
- Always validate inputs, log aggressively.
- Emit metadata event first so the client can set status badges.
- Non-stream fallback simply returns JSON from `executeAgent`.

### 2. Agent Core (`packages/ai-agent/src/agent.ts`)

```ts
export async function* executeAgentStream(request: AgentRequest, config: AgentConfig) {
  const client = new Anthropic({ apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY });
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: contextualPrompt }];
  const tools = agentTools.map(/* convert zod schema to Anthropic shape */);

  while (step < maxSteps) {
    const stream = client.messages.stream({ model: DEFAULT_MODEL, system: SYSTEM_PROMPT, messages, tools });
    const toolUses = [];

    for await (const event of stream) {
      if (event.delta?.type === 'text_delta') {
        yield JSON.stringify({ type: 'text', text: event.delta.text }) + '\n';
      }
      // capture tool input / completion, push to toolUses
    }

    const finalMessage = await stream.finalMessage();
    for (const toolUse of toolUses) {
      const tool = agentTools.find((t) => t.name === toolUse.name);
      const result = await tool.execute(JSON.parse(toolUse.input));
      yield JSON.stringify({ type: 'tool_result', result }) + '\n';
      messages.push({ role: 'assistant', content: finalMessage.content }, /* tool_result message */);
    }

    if (finalMessage.stop_reason === 'end_turn') break;
  }
}
```

Highlights:
- Uses Anthropic streaming API; we process `content_block_delta` events.
- Text deltas propagate immediately to the client.
- Tool results are yielded back to the SSE channel for UI logging.
- After each tool run we append both the assistant content and a `tool_result` block so Anthropic maintains context.

### 3. Tool Catalogue (`packages/ai-agent/src/agent-tools.ts`)

```ts
const getSowInputSchema = z.object({ sowId: z.string().uuid() });

export const getSowTool: AgentTool = {
  name: 'get_sow',
  description: 'Fetches current SOW details…',
  input_schema: zodToJsonSchema(getSowInputSchema),
  async execute(input) {
    const { sowId } = getSowInputSchema.parse(input);
    const sow = await getSowById(sowId);
    const items = await getItemsForSow(sowId);
    const details = await Promise.all(items.map(async (item) => ({
      ...item,
      criteria: await getCriteriaForTaskItem(item.id),
    })));
    return formatSowMarkdown(sow, details);
  },
};
```

`create_requirement` and `generate_tests` follow the same pattern:
- Validate inputs with zod.
- Fetch necessary DB context.
- Call helper `generateCriteria` or `generateTests` with Anthropic (plain `client.messages.create`).
- Persist new `items`, `criterion`, `tests` via Drizzle functions.
- Return human-readable confirmation text (includes IDs so `extractEntitiesFromText` can tag affected SOW entities).

**Type normalization**: Because `items.type` is constrained (`requirement`, `task_item`, `milestone`, `dependency`, `deliverable`), we map arbitrary prompts to a supported type and store the original request under `metadata.requestedType`.

### 4. Database Changes

- `criterion.acceptance_criteria` column (migration `0009`).
- `tests.test_type`, `tests.priority`, `tests.test_format` columns (migration `0010`).
- Functions updated to use real IDs instead of mock placeholders (`getCriteriaWithTestsForTaskItem`).
- Frontend `transformItems` now copies those test fields so the UI renders actual data.

### 5. Streaming Hook (`apps/web/hooks/use-ai-agent-stream.ts`)

```ts
export function useAIAgentStream({ onMetadata, onTextChunk, onComplete, onError }: UseAIAgentStreamOptions = {}) {
  const [streamedText, setStreamedText] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const startStream = useCallback(async (query: string, params?: { sowId?: string; sessionId?: string }) => {
    abortRef.current = new AbortController();
    const response = await fetch('/api/ai/agent', {
      method: 'POST',
      body: JSON.stringify({ query, sowId: params?.sowId, sessionId: params?.sessionId, stream: true }),
      signal: abortRef.current.signal,
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    while (reader) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      chunk.split('\n\n').forEach((line) => {
        if (!line.startsWith('data: ')) return;
        const data = JSON.parse(line.replace('data: ', ''));
        if (['text', 'text-delta', 'text_delta'].includes(data.type)) {
          const textChunk = data.text ?? data.textDelta ?? data.content ?? data.delta?.text ?? '';
          fullText += textChunk;
          setStreamedText(fullText);
          onTextChunk?.(textChunk);
        }
        if (data.type === 'metadata') {
          onMetadata?.({
            classification: normalizeClassification(data),
            requiresApproval: data.requiresApproval,
            agentsUsed: data.agentsUsed ?? [],
            sessionId: data.sessionId,
          });
        }
        if (data.type === 'error') throw new Error(data.error);
      });
    }

    onComplete?.({ text: fullText, isComplete: true });
  }, [onMetadata, onTextChunk, onComplete]);

  return { startStream, cancelStream: () => abortRef.current?.abort(), streamedText, /* ... */ };
}
```

### 6. Chat UI (`apps/web/components/dashboard/sow/sow-chat-dialog.tsx`)

- Accepts `inline` prop so we can embed the chat as a sidebar or render inside a sheet.
- Loads chat sessions/history via `/api/sow/[id]/chat-sessions` and `/chat-history`.
- Persists new messages by POSTing to `/chat-history` inside `persistMessages`.
- Provides workflow presets (scratch/import/iterative) stored in `WORKFLOW_MODES`.
- Supports change preview: collects `ChangeProposal[]`, opens `SowChangePreviewDialog`, and after PATCH success appends a success message.
- Inline variant is used on the SOW page (`xl` sticky sidebar) so the assistant stays visible while users switch between Details, Feedback, Acceptance Test Procedure, etc.

### 7. Page Integration (`apps/web/app/(protected)/sows/[id]/sow-interface.tsx`)

- Adds `acceptanceTests` memo to flatten DB data for the “Acceptance Test Procedure” tab.
- Embeds `<SowChatDialog inline className="h-full" />` in a sidebar `<aside>` so the chat is always available.
- On `onSowUpdate`, calls `router.refresh()` and shows a toast.

### RFC Assistant Additions

- New RFC-specific tools live in `agent-tools.ts` (`get_rfc` and `update_rfc_section`) and are activated whenever `AgentRequest` contains `rfcId`.
- `apps/web/components/rfcs/rfc-chat-panel.tsx` mirrors the SOW chat workflow but targets `/api/rfc/[rfcId]/chat-history` and passes `rfcId` to the agent.
- The RFC detail page (`app/(protected)/rfcs/[rfcId]/page.tsx`) now renders the chat panel inline so reviewers can draft sections while reading the document.
- RFC conversations persist in `rfc_chat_history` via the new API routes under `app/api/rfc/[rfcId]/`.

---

## Example End-to-End Flow

1. User opens the SOW page; sidebar `SowChatDialog` loads chat sessions and displays the welcome message.
2. User sends “Add a task item about authentication.” The hook calls `/api/ai/agent` with `{ stream: true }`.
3. SSE metadata arrives, UI shows “general • response”.
4. Text deltas stream in for narration.
5. Agent decides to call `create_requirement`. Backend logs `[TOOL:create_requirement]`, DB writes new `items`, `criterion` rows.
6. `tool_result` event is emitted so UI can log “✅ DONE! Created requirement …”.
7. On “Apply Changes,” UI sends selected proposals to `/api/sow/[id]` and refreshes on success.
8. Acceptance Test Procedure tab now lists the created tests since `transformItems` exposes real DB data.

---

## Debugging & Verification

- Enable server logs (see sample output in the prompt) to trace `[AGENT:STREAM]` and `[TOOL:*]` entries.
- `apps/web/hooks/use-ai-agent-stream.ts` logs text deltas (temporarily) if you need to inspect raw SSE.
- Ensure migrations are applied; missing columns manifest as “column `acceptance_criteria` does not exist” or “column `test_type` does not exist.” Running `pnpm --filter @tanda/database db:migrate` fixes this.
- For frontend errors (e.g., `[] is not a function` in `sow-interface.tsx`), check hooks/memos, especially when flattening arrays from DB.

---

## Porting Checklist

1. **Duplicate the API route** under your target app, adjust request validation, but keep the SSE contract identical.
2. **Reuse `packages/ai-agent`** as-is or extend `agent-tools.ts` with new tools. Make sure to export them in the `agentTools` array.
3. **Implement any new tools** with Drizzle functions in `packages/database/functions/*`; update schemas/migrations as needed.
4. **Use `use-ai-agent-stream`** in your frontend. Only the UI component around it typically changes.
5. **Persist chat sessions** by creating `/api/<entity>/<id>/chat-history` + `/chat-sessions` endpoints mirroring the SOW/RFC implementations.
6. **Embed the chat** where it makes sense (modal, drawer, inline). For parity with SOW, pass `inline`.
7. **Document migrations/env vars** in the target app’s README so future developers remember to set `ANTHROPIC_API_KEY` and apply DB schema updates.

Following this template reproduces the current SOW Assistant experience: Anthropic-driven streaming, tool execution, and a collaborative UI that stays open while users inspect different parts of the statement of work. Use the provided file references and snippets as a starting point when creating agents for other workflows.
