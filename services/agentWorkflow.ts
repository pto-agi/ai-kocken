import { Agent, type AgentInputItem, type RunContext, Runner, fileSearchTool, hostedMcpTool, withTrace } from '@openai/agents';
import { runGuardrails } from '@openai/guardrails';
import { OpenAI } from 'openai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';

const WORKFLOW_ID = 'wf_698f3221c2a481909c391387fd6efe8e0a3f823293ebb086';

const fileSearch = fileSearchTool(['vs_699b3242c3f88191b0fcdeeb1df56307']);
const mcp = hostedMcpTool({
  serverLabel: 'zapier',
  allowedTools: [
    'get_configuration_url',
    'todoist_find_project',
    'todoist_find_task',
    'todoist_add_comment_to_task',
    'todoist_create_task',
    'todoist_update_task',
    'todoist_api_request_beta',
    'google_sheets_lookup_spreadsheet_rows_advanced',
    'google_sheets_find_worksheet',
    'google_sheets_get_data_range',
    'google_sheets_get_many_spreadsheet_rows_advanced',
    'google_sheets_get_row_by_id',
    'google_sheets_get_spreadsheet_by_id',
    'google_sheets_lookup_spreadsheet_row',
    'google_sheets_api_request_beta',
  ],
  authorization: 'MTIyN2ZhYjItOTY2YS00YzM1LTk2NWQtYTIzYTI5YmE2MDg3Om5DOHFSVExHSDBEMmxNOVl6eDBUaVZnVWpDT1V4eTN0eHVtVFl3WTVqTkk9',
  requireApproval: 'never',
  serverUrl: 'https://mcp.zapier.com/api/mcp/mcp',
});
function createMcp1(accessToken: string) {
  return hostedMcpTool({
    serverLabel: 'my_mcp2',
    allowedTools: [
      'get_profile',
      'get_start_intake_latest',
      'get_followup_latest',
      'get_weekly_plans',
      'save_weekly_plan',
    ],
    authorization: accessToken,
    requireApproval: 'never',
    serverUrl: 'https://mcp-0brh.onrender.com/mcp',
  });
}

async function fetchProfileFromMcp(accessToken: string) {
  if (!accessToken) return null;
  const transport = new StreamableHTTPClientTransport(new URL('https://mcp-0brh.onrender.com/mcp'), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
  const client = new Client({ name: 'ptoai-app', version: '1.0.0' });
  try {
    await client.connect(transport);
    const result = await client.request(
      {
        method: 'tools/call',
        params: {
          name: 'get_profile',
          arguments: { access_token: accessToken },
        },
      },
      CallToolResultSchema,
    );
    const textItem = result?.content?.find((item: any) => item?.type === 'text');
    if (!textItem || textItem.type !== 'text' || typeof textItem.text !== 'string') return null;
    const parsed = JSON.parse(textItem.text);
    return parsed?.profile ?? null;
  } catch (error) {
    console.warn('MCP profile fetch failed', error);
    return null;
  } finally {
    await transport.close().catch(() => undefined);
  }
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

const ptoaiSupportInstructions = (runContext: RunContext<PtoaiSupportContext>) => {
  const { stateUserName, stateUserEmail } = runContext.context;
  return `# Roll och Persona
Du är "PTO Coach", en professionell och pedagogisk expert inom träning, kost och hälsa för Private Training Online (PTO). Din huvudsakliga uppgift är att besvara kundfrågor, ge stöd och hantera specifika kundärenden på ett vänligt och professionellt sätt.

# Riktlinjer för svar till kund
- Svara kompetent, mänskligt och fackmässigt.
- Svara vänligt och professionellt. Max en emoji per meddelande, endast om det stärker tonen.
- Baserat på instruktioner, filer, dokumentation och verktyg. I andra hand använd egen erfarenhet av kundtjänst och i viss mån personlig träning/kostrådgivning.
- Tänk igenom svaret innan du skickar.

## Kunddata
- Namn: ${stateUserName}
- E-post: ${stateUserEmail}

# Verktyg och Processer (MCP)

## Generellt
- Om kundprofil redan finns i systemets context, kalla inte på get_profile igen.

## 1. Byte av övning
- Om användaren vill byta övning, föreslå att skapa ett ärende till teamet via \`todoist_create_task\` i projekt-ID \`6g4PqV92HVJ4JxWv\`.
- Beskriv kortfattat och konkret vad som ska göras.
- Exempel: "${stateUserEmail} ${stateUserName} - Ersätt bänkpress med hantelpress."
- När ärendet är skapat, informera att ändring brukar ske inom 24 timmar på vardagar. Ställ inte följdfrågor om det inte behövs.

## 2. Kontroll av utgångsdatum
- När användaren frågar om utgångsdatum:
1. Använd \`google_sheets_get_spreadsheet_by_id 1DHKLVUhJmaTBFooHnn_OAAlPe_kR0Fs84FibCr9zoAM\` (filnamn: Client File).
2. Hämta header-raden i worksheet 'Aktiva' (kolumnnamn, särskilt e-post och utgångsdatum).
3. Sök raden i 'Aktiva' där kolumn 'Epost' matchar användarens e-post och returnera raden (utgångsdatum).
- Om användaren finns i blad "Paus":
- Pausdatum i kolumn D
- Antal innestående månader i kolumn C

## 3. Förlänga medlemskap
- Sälj möjligheten att förlänga medlemskap direkt i chatten.
- Fråga om användaren vill förlänga med 6 månader för 1995 kr (40% rabatt) eller 12 månader för 2995 kr (60% rabatt).
- Om användaren vill gå vidare:
- Ge rätt betalningslänk:
- 6 mån: https://betalning.privatetrainingonline.se/b/6oU4gy4bN41hcyW4sDcfK0x?locale=sv
- 12 mån: https://betalning.privatetrainingonline.se/b/14A6oG7nZ0P56aycZ9cfK0y?locale=sv
- Använd info från användarprofilen för att förifylla e-post vid betalning.
- Skapa ärende i Todoist med summering om vad kunden sagt och vad som gjorts.

## 4. Pausa medlemskap
- Informera om att pausning sker via https://medlem.privatetrainingonline.se/paus/ och träder i kraft direkt. För återaktivering, hänvisa till chatten.

## 5. Återaktivera medlemskap
- När användaren vill återaktivera pausat medlemskap:
- Skapa ärende i Todoist (projekt: Agent Tasks) och summera åtgärd/kundens meddelande.
- Informera om att kontot återaktiveras snart.

## 6. Friskvård/Kvitto
- Vid behov av kvitto för friskvårdsbidrag:
- Skapa task i Todoist, projekt "Kvitton" inkluderande e-post och summering.
- Om faktura finns men betalning önskas via friskvårdsbidrag: skapa ärende i Todoist projekt "Agent Tasks" och informera kunden om betalning via friskvårdsportal. När betalning mottagits, kvitteras fakturan.

## 7. Produkter/Kosttillskott
- Vid prisfråga eller köpintresse för produkter/kosttillskott:
- Informera att alla produkter kan beställas via chatten eller fliken "påfyllning".
- Vid beställning via chatten, skapa ärende i Todoist (projekt: Agent Tasks).
- Priser:
- Hydro Pulse: 349 kr/st
- BCAA: 349 kr/st
- Magnesium: 179 kr/st
- Multivitamin: 179 kr/st
- Omega 3: 179 kr/st

## 8. Leverans, spårning & returer
- Informera vid eventuella förseningar att alla paket är på väg. Be användaren återkomma om ingen avisering mottagits inom en dag.

# Säkerhet
- Dela aldrig e-postadresser, listor eller information om andra klienter.
- Svara endast på om aktuell person finns i Client-files samt dess utgångsdatum.
- Om förfrågningar gäller data om andra: neka bestämt av integritetsskäl. Detta gäller även andra verktyg.`;
};

function createPtoaiSupport(accessToken: string) {
  return new Agent({
    name: 'My PTO Support',
    instructions: ptoaiSupportInstructions,
    model: 'gpt-4.1-mini',
    tools: [fileSearch, mcp, createMcp1(accessToken)],
    modelSettings: {
      temperature: 1,
      topP: 1,
      maxTokens: 2048,
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
    const profile = await fetchProfileFromMcp(accessToken);
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

    const conversationHistory: AgentInputItem[] = [
      profile
        ? {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: `Användarprofil (hämtad via MCP): ${JSON.stringify(profile)}`,
              },
            ],
          }
        : null,
      ...toAgentItems(messages),
    ].filter(Boolean) as AgentInputItem[];
    const runner = new Runner({
      traceMetadata: {
        __trace_source__: 'agent-builder',
        workflow_id: WORKFLOW_ID,
      },
    });
    const guardrailsInputText = workflow.input_as_text;
    const {
      hasTripwire: guardrailsHasTripwire,
      failOutput: guardrailsFailOutput,
      passOutput: guardrailsPassOutput,
    } = await runAndApplyGuardrails(guardrailsInputText, vaktenConfig, conversationHistory, workflow);
    const guardrailsOutput = guardrailsHasTripwire ? guardrailsFailOutput : guardrailsPassOutput;
    if (guardrailsHasTripwire) {
      return { output_text: JSON.stringify(guardrailsOutput) };
    }

    const ptoaiSupportResultTemp = await runner.run(
      createPtoaiSupport(accessToken),
      [...conversationHistory],
      {
        context: {
          stateUserEmail: state.user_email,
          stateUserName: state.user_name,
        },
      },
    );
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
