import { fileSearchTool, tool, RunContext, Agent, AgentInputItem, Runner, withTrace } from '@openai/agents';
import { OpenAI } from 'openai';
import { runGuardrails } from '@openai/guardrails';
import {
  todoistCreateTask,
  todoistFindProject,
  todoistFindTask,
  todoistAddComment,
  sheetsGetWorksheetData,
  sheetsLookupByEmail,
  sheetsGetSpreadsheetInfo,
  getProfileDirect,
} from './directTools.js';

// All agent logic is owned in-code. No Agent Builder or Zapier MCP.

// Tool definitions
const fileSearch = fileSearchTool(['vs_699b3242c3f88191b0fcdeeb1df56307']);

const AGENT_MODEL = process.env.AGENT_MODEL || 'gpt-5-mini';

// Default Google Sheet ID for client data
const CLIENT_SHEET_ID = process.env.GOOGLE_SHEET_ID || '1DHKLVUhJmaTBFooHnn_OAAlPe_kR0Fs84FibCr9zoAM';

// ─── Direct Todoist Tools ────────────────────────────────────────

const todoistCreateTaskTool = tool({
  name: 'todoist_create_task',
  description: 'Skapa en ny uppgift i Todoist. Ange projekt-ID och uppgiftens titel. Beskrivning och sektion är valfria (skicka tom sträng om ej relevant).',
  parameters: {
    type: 'object' as const,
    properties: {
      project_id: { type: 'string', description: 'Todoist project ID' },
      content: { type: 'string', description: 'Task title/content' },
      description: { type: 'string', description: 'Task description, or empty string if not needed' },
      section_id: { type: 'string', description: 'Section ID, or empty string if not needed' },
    },
    required: ['project_id', 'content', 'description', 'section_id'],
    additionalProperties: false as const,
  },
  execute: async (input: any) => {
    return await todoistCreateTask({
      projectId: input.project_id,
      content: input.content,
      description: input.description || undefined,
      sectionId: input.section_id || undefined,
    });
  },
});

const todoistFindProjectTool = tool({
  name: 'todoist_find_project',
  description: 'Hitta ett Todoist-projekt med namn. Returnerar projekt-ID och metadata.',
  parameters: {
    type: 'object' as const,
    properties: {
      name: { type: 'string', description: 'Project name to search for' },
    },
    required: ['name'],
    additionalProperties: false as const,
  },
  execute: async (input: any) => {
    return await todoistFindProject(input.name);
  },
});

const todoistFindTaskTool = tool({
  name: 'todoist_find_task',
  description: 'Sök efter uppgifter i Todoist. Ange project_id och/eller query (tom sträng = alla uppgifter).',
  parameters: {
    type: 'object' as const,
    properties: {
      project_id: { type: 'string', description: 'Project ID to search in, or empty string for all projects' },
      query: { type: 'string', description: 'Text to filter tasks by content, or empty string for all' },
    },
    required: ['project_id', 'query'],
    additionalProperties: false as const,
  },
  execute: async (input: any) => {
    return await todoistFindTask({ projectId: input.project_id || undefined, query: input.query || undefined });
  },
});

const todoistAddCommentTool = tool({
  name: 'todoist_add_comment',
  description: 'Lägg till en kommentar på en Todoist-uppgift.',
  parameters: {
    type: 'object' as const,
    properties: {
      task_id: { type: 'string', description: 'The task ID to add a comment to' },
      content: { type: 'string', description: 'Comment text' },
    },
    required: ['task_id', 'content'],
    additionalProperties: false as const,
  },
  execute: async (input: any) => {
    return await todoistAddComment(input.task_id, input.content);
  },
});

// ─── Direct Google Sheets Tools ──────────────────────────────────

const sheetsGetDataTool = tool({
  name: 'sheets_get_data',
  description: 'Hämta rader från ett Google Sheets-blad. Returnerar header och data. Standard sheet_id = Client File. Skicka tom sträng för sheet_id/range om ej relevant.',
  parameters: {
    type: 'object' as const,
    properties: {
      sheet_id: { type: 'string', description: 'Google Spreadsheet ID, or empty string for default Client File' },
      worksheet_name: { type: 'string', description: 'Worksheet/tab name, e.g. "Aktiva", "Paus", "Expired"' },
      range: { type: 'string', description: 'A1 range e.g. "A1:F50", or empty string for all data' },
    },
    required: ['sheet_id', 'worksheet_name', 'range'],
    additionalProperties: false as const,
  },
  execute: async (input: any) => {
    return await sheetsGetWorksheetData({
      sheetId: input.sheet_id || CLIENT_SHEET_ID,
      worksheetName: input.worksheet_name,
      range: input.range || undefined,
    });
  },
});

const sheetsLookupEmailTool = tool({
  name: 'sheets_lookup_email',
  description: 'Sök efter en kund via e-post i ett Google Sheets-blad. Returnerar hela raden för matchad klient. Skicka tom sträng för sheet_id om ej relevant.',
  parameters: {
    type: 'object' as const,
    properties: {
      sheet_id: { type: 'string', description: 'Google Spreadsheet ID, or empty string for default Client File' },
      worksheet_name: { type: 'string', description: 'Worksheet/tab name, e.g. "Aktiva", "Paus"' },
      email: { type: 'string', description: 'Email address to search for' },
    },
    required: ['sheet_id', 'worksheet_name', 'email'],
    additionalProperties: false as const,
  },
  execute: async (input: any) => {
    return await sheetsLookupByEmail({
      sheetId: input.sheet_id || CLIENT_SHEET_ID,
      worksheetName: input.worksheet_name,
      email: input.email,
    });
  },
});

const sheetsGetInfoTool = tool({
  name: 'sheets_get_info',
  description: 'Hämta metadata om ett Google Sheets-dokument: titel, alla blad/worksheets och antal rader. Skicka tom sträng för sheet_id om ej relevant.',
  parameters: {
    type: 'object' as const,
    properties: {
      sheet_id: { type: 'string', description: 'Google Spreadsheet ID, or empty string for default Client File' },
    },
    required: ['sheet_id'],
    additionalProperties: false as const,
  },
  execute: async (input: any) => {
    return await sheetsGetSpreadsheetInfo(input.sheet_id || CLIENT_SHEET_ID);
  },
});

// All direct tools in one array
const directTools = [
  todoistCreateTaskTool,
  todoistFindProjectTool,
  todoistFindTaskTool,
  todoistAddCommentTool,
  sheetsGetDataTool,
  sheetsLookupEmailTool,
  sheetsGetInfoTool,
];

async function fetchProfileDirect(accessToken: string) {
  if (!accessToken) return null;
  try {
    return await getProfileDirect(accessToken);
  } catch (error) {
    console.warn('Direct profile fetch failed', error);
    return null;
  }
}

// Shared client for guardrails and file search
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Guardrails definitions
const vaktenConfig = {
  guardrails: [{ name: 'Jailbreak', config: { model: 'gpt-4.1-mini', confidence_threshold: 0.7 } }],
};
const context = { guardrailLlm: client };

function guardrailsHasTripwire(results: any[]): boolean {
  return (results ?? []).some((r) => r?.tripwireTriggered === true);
}

function getGuardrailSafeText(results: any[], fallbackText: string): string {
  for (const r of results ?? []) {
    if (r?.info && 'checked_text' in r.info) {
      return r.info.checked_text ?? fallbackText;
    }
  }
  const pii = (results ?? []).find((r) => r?.info && 'anonymized_text' in r.info);
  return pii?.info?.anonymized_text ?? fallbackText;
}

async function scrubConversationHistory(history: any[], piiOnly: any): Promise<void> {
  for (const msg of history ?? []) {
    const content = Array.isArray(msg?.content) ? msg.content : [];
    for (const part of content) {
      if (part && typeof part === 'object' && part.type === 'input_text' && typeof part.text === 'string') {
        const res = await runGuardrails(part.text, piiOnly, context, true);
        part.text = getGuardrailSafeText(res, part.text);
      }
    }
  }
}

async function scrubWorkflowInput(workflow: any, inputKey: string, piiOnly: any): Promise<void> {
  if (!workflow || typeof workflow !== 'object') return;
  const value = workflow?.[inputKey];
  if (typeof value !== 'string') return;
  const res = await runGuardrails(value, piiOnly, context, true);
  workflow[inputKey] = getGuardrailSafeText(res, value);
}

async function runAndApplyGuardrails(inputText: string, config: any, history: any[], workflow: any) {
  const guardrails = Array.isArray(config?.guardrails) ? config.guardrails : [];
  const results = await runGuardrails(inputText, config, context, true);
  const shouldMaskPII = guardrails.find((g) => g?.name === 'Contains PII' && g?.config && g.config.block === false);
  if (shouldMaskPII) {
    const piiOnly = { guardrails: [shouldMaskPII] };
    await scrubConversationHistory(history, piiOnly);
    await scrubWorkflowInput(workflow, 'input_as_text', piiOnly);
    await scrubWorkflowInput(workflow, 'input_text', piiOnly);
  }
  const hasTripwire = guardrailsHasTripwire(results);
  const safeText = getGuardrailSafeText(results, inputText) ?? inputText;
  return {
    results,
    hasTripwire,
    safeText,
    failOutput: buildGuardrailFailOutput(results ?? []),
    passOutput: { safe_text: safeText },
  };
}

function buildGuardrailFailOutput(results: any[]) {
  const get = (name: string) =>
    (results ?? []).find((r: any) => (r?.info?.guardrail_name ?? r?.info?.guardrailName) === name);
  const pii = get('Contains PII');
  const mod = get('Moderation');
  const jb = get('Jailbreak');
  const hal = get('Hallucination Detection');
  const nsfw = get('NSFW Text');
  const url = get('URL Filter');
  const custom = get('Custom Prompt Check');
  const pid = get('Prompt Injection Detection');
  const piiCounts = Object.entries(pii?.info?.detected_entities ?? {})
    .filter(([, v]) => Array.isArray(v))
    .map(([k, v]) => `${k}:${(v as any[]).length}`);
  return {
    pii: { failed: piiCounts.length > 0 || pii?.tripwireTriggered === true, detected_counts: piiCounts },
    moderation: {
      failed: mod?.tripwireTriggered === true || (mod?.info?.flagged_categories ?? []).length > 0,
      flagged_categories: mod?.info?.flagged_categories,
    },
    jailbreak: { failed: jb?.tripwireTriggered === true },
    hallucination: {
      failed: hal?.tripwireTriggered === true,
      reasoning: hal?.info?.reasoning,
      hallucination_type: hal?.info?.hallucination_type,
      hallucinated_statements: hal?.info?.hallucinated_statements,
      verified_statements: hal?.info?.verified_statements,
    },
    nsfw: { failed: nsfw?.tripwireTriggered === true },
    url_filter: { failed: url?.tripwireTriggered === true },
    custom_prompt_check: { failed: custom?.tripwireTriggered === true },
    prompt_injection: { failed: pid?.tripwireTriggered === true },
  };
}

interface PtoaiSupportContext {
  stateUserName: string | null;
  stateUserEmail: string | null;
}

const ptoaiSupportInstructions = (runContext: RunContext<PtoaiSupportContext>, _agent: Agent<PtoaiSupportContext>) => {
  const { stateUserName, stateUserEmail } = runContext.context;
  const safeName = stateUserName ?? '';
  const safeEmail = stateUserEmail ?? '';
  return `Kundtjänst, Support och Coach

Du är PTO Coach, en personlig, glad och kompetent coach, support och kundtjänst hos PTO.

Riktlinjer för svar till kund:
- Svara personligt, vänligt och likt PTO i kommunikationsstilen. 
- Använd 0-2 emoji när det passar.
- Du visar på att du förstår användaren och att du pedogiskt kan hjälpa användaren

Data
- Namn: ${safeName}
- E-post: ${safeEmail}
- Fil: faq.md = Vanliga frågor och svar
- Fil: instruction.md = Dina instruktioner
- Storage: Admin Agent = Samling av filerna faq.md och instruction.md 
- Verktyg: todoist_create_task, todoist_find_project, todoist_find_task, todoist_add_comment = Direkt Todoist API
- Verktyg: sheets_get_data, sheets_lookup_email, sheets_get_info = Direkt Google Sheets API

RUN BOOKS

1. Byte av övning / Ta bort övning

När användaren vill byta ut eller ta bort en övning behöver vi veta vilken övning det gäller. Gör det enkelt för användaren och undvik alltför många följdfrågor.

- Om användaren vill **ta bort** en övning: fråga INTE efter någon ersättning – skapa ärendet direkt.
- Om användaren vill **byta** en övning: ta reda på vilken övning de vill ha i stället om det inte redan framgår.

När det ska skapas ett ärende/uppgift för att något ska ändras i klientens program:

- Skapa ett ärende till oss genom verktyget för att skapa en uppgift i todoist uppgift under projekt-ID 6g4PqV92HVJ4JxWv
- Exempel byte: "${stateUserEmail} - Ersätt bänkpress med hantelpress."
- Exempel borttagning: "${stateUserEmail} - Ta bort hantelknäböj."
- När uppgiften är skapad, informera att ändring brukar ske inom 24 timmar på vardagar.

2. Utgångsdatum
- När användaren frågar om utgångsdatum:

1. Använd verktyget 'sheets_lookup_email' med worksheet_name='Aktiva' och email=användarens e-post. Det returnerar hela raden inklusive utgångsdatum.
2. Om användaren ej hittas i 'Aktiva', sök i worksheet 'Paus' på samma sätt.
- Om användaren finns i blad "Paus":
- Pausdatum i kolumn D
- Antal innestående månader i kolumn C

3. Förlänga medlemskap

- Sälj möjligheten att förlänga medlemskap direkt i chatten.
- Fråga om användaren vill förlänga med 6 månader för 1995 kr (40% rabatt) eller 12 månader för 2995 kr (60% rabatt).

- Om användaren vill gå vidare:
- Ge rätt betalningslänk:
- 6 mån: https://betalning.privatetrainingonline.se/b/6oU4gy4bN41hcyW4sDcfK0x?locale=sv
- 12 mån: https://betalning.privatetrainingonline.se/b/14A6oG7nZ0P56aycZ9cfK0y?locale=sv
- Använd info från användarprofilen för att förifylla e-post vid betalning.
- Skapa ärende i Todoist med summering om vad kunden sagt och vad som gjorts.

4. Pausa medlemskap
- Informera om att pausning sker via https://medlem.privatetrainingonline.se/paus/ och träder i kraft direkt. För återaktivering, hänvisa till chatten.

5. Återaktivera medlemskap
- När användaren vill återaktivera pausat medlemskap:
- Skapa ärende i Todoist (projekt: Agent Tasks) och summera åtgärd/kundens meddelande.
- Informera om att kontot återaktiveras snart.

6. Friskvård/Kvitto
- Vid behov av kvitto för friskvårdsbidrag:
- Skapa task i Todoist, projekt "Kvitton" inkluderande e-post och summering.
- Om faktura finns men betalning önskas via friskvårdsbidrag: skapa ärende i Todoist projekt "Agent Tasks" och informera kunden om betalning via friskvårdsportal. När betalning mottagits, kvitteras fakturan.

7. Produkter/Kosttillskott
- Vid prisfråga eller köpintresse för produkter/kosttillskott:
- Informera att alla produkter kan beställas via chatten eller fliken "påfyllning".
- Vid beställning via chatten, skapa ärende i Todoist (projekt: Agent Tasks).
- Priser:
- Hydro Pulse: 349 kr/st
- BCAA: 349 kr/st
- Magnesium: 179 kr/st
- Multivitamin: 179 kr/st
- Omega 3: 179 kr/st

8. Leverans, spårning & returer
- Informera vid eventuella förseningar att alla paket är på väg. Be användaren återkomma om ingen avisering mottagits inom en dag.`;
};

function createPtoaiSupport(_accessToken: string) {
  return new Agent({
    name: 'PTOAi Support',
    instructions: ptoaiSupportInstructions,
    model: AGENT_MODEL,
    tools: [fileSearch, ...directTools],
    modelSettings: {
      store: true,
    },
  });
}

type WorkflowInput = { input_as_text: string };

export type WorkflowResult = { output_text: string };

type UIMessage = {
  id?: string;
  role?: 'user' | 'assistant' | 'system' | string;
  content?: string;
  parts?: Array<{ type: string; text?: string }>;
};

function extractTextParts(message: UIMessage): string[] {
  if (Array.isArray(message.parts) && message.parts.length > 0) {
    return message.parts
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text as string)
      .filter((text) => text.trim().length > 0);
  }
  if (typeof message.content === 'string' && message.content.trim().length > 0) {
    return [message.content];
  }
  return [];
}

function toAgentItems(messages: UIMessage[]): AgentInputItem[] {
  return messages
    .map((message) => {
      const parts = extractTextParts(message);
      if (!parts.length) return null;
      const isAssistant = message.role === 'assistant';
      if (message.role === 'system') return null;
      const role = isAssistant ? 'assistant' : 'user';
      const contentType = isAssistant ? 'output_text' : 'input_text';
      return {
        role,
        content: [{ type: contentType, text: parts.join('\n') }],
      } as AgentInputItem;
    })
    .filter(Boolean) as AgentInputItem[];
}

export const runWorkflow = async (messages: UIMessage[], accessToken: string): Promise<WorkflowResult> => {
  const lastUser = [...messages].reverse().find((m) => m?.role === 'user' && extractTextParts(m).length);
  const inputText = lastUser ? extractTextParts(lastUser).join('\n') : '';
  const workflow: WorkflowInput = { input_as_text: inputText };
  return await withTrace('PTO Agent-1', async () => {
    const state = {
      user_id: null,
      user_email: null,
      user_name: null,
      membership_level: null,
      subscription_status: null,
      coaching_expires_at: null,
      target_calories: null,
      biometrics_json: null,
    };
    const profile = await fetchProfileDirect(accessToken);
    const profileName =
      (typeof profile?.full_name === 'string' && profile.full_name.trim()) ||
      (typeof profile?.name === 'string' && profile.name.trim()) ||
      (typeof profile?.first_name === 'string' && profile.first_name.trim()) ||
      null;
    const profileEmail =
      (typeof profile?.email === 'string' && profile.email.trim()) ||
      (typeof profile?.email_address === 'string' && profile.email_address.trim()) ||
      null;
    state.user_email = profileEmail;
    state.user_name = profileName;

    const conversationHistory: AgentInputItem[] = [...toAgentItems(messages)];
    const runner = new Runner({
      traceMetadata: {
        __trace_source__: 'pto-agent',
      },
    });
    const guardrailsInputText = workflow.input_as_text;
    const { hasTripwire: guardrailsHasTripwire, failOutput: guardrailsFailOutput, passOutput: guardrailsPassOutput } =
      await runAndApplyGuardrails(guardrailsInputText, vaktenConfig, conversationHistory, workflow);
    const guardrailsOutput = guardrailsHasTripwire ? guardrailsFailOutput : guardrailsPassOutput;
    if (guardrailsHasTripwire) {
      return { output_text: JSON.stringify(guardrailsOutput) };
    }

    const ptoaiSupportResultTemp = await runner.run(createPtoaiSupport(accessToken), [...conversationHistory], {
      context: {
        stateUserName: state.user_name,
        stateUserEmail: state.user_email,
      },
    });
    conversationHistory.push(...ptoaiSupportResultTemp.newItems.map((item) => item.rawItem));

    if (!ptoaiSupportResultTemp.finalOutput) {
      throw new Error('Agent result is undefined');
    }

    const ptoaiSupportResult = {
      output_text: ptoaiSupportResultTemp.finalOutput ?? '',
    };

    return ptoaiSupportResult;
  });
};

/**
 * Streaming variant of runWorkflow.
 * Runs the agent to completion, then yields the output in small chunks
 * via the onChunk callback for SSE/typewriter-effect streaming.
 */
export const runWorkflowStream = async (
  messages: UIMessage[],
  accessToken: string,
  onChunk: (chunk: string, done: boolean) => void,
): Promise<void> => {
  const result = await runWorkflow(messages, accessToken);
  const text = result.output_text;

  // Stream in ~30-char chunks with small delays for typewriter effect
  const CHUNK_SIZE = 30;
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    const chunk = text.slice(i, i + CHUNK_SIZE);
    const isLast = i + CHUNK_SIZE >= text.length;
    onChunk(chunk, isLast);
    if (!isLast) {
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
  }

  // If text was empty, signal done
  if (!text.length) {
    onChunk('', true);
  }
};
