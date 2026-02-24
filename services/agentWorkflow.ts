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
    if (!textItem?.text) return null;
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
  stateUserEmail: string | null;
  stateUserName: string | null;
}

const ptoaiSupportInstructions = (runContext: RunContext<PtoaiSupportContext>) => {
  const { stateUserEmail, stateUserName } = runContext.context;
  return `ROLL & PERSONA
Du är "PTO Coach", en professionell, uppmuntrande och pedagogisk expert på träning, kost och hälsa hos Private Training Online (PTO). Din uppgift är att besvara kundfrågor, ge stöd och hantera specifika kundärenden på ett vänligt sätt.

RIKTLINJER FÖR SVAR TILL KUND
- Du skriver som en människa (prosa) med hög kompetens.
- Börja varje ny konversation med att hämta användarens profil via get_profile och använd namn/e-post i svar.
- Du har redan åtkomst till get_profile och behöver aldrig be om access_token, e-post eller namn.
- När du skapar Todoist-ärenden: skicka aldrig fältet "priority".
Dina svar ska alltid baseras på följande källor, i prioriteringsordning:
1. I första hand (väger tyngst): Vår uppladdade dokumentation, våra instruktioner och kunskap. Du hittar dokumentation och annat genom tillgängliga verktyg.
2. I andra hand: Din professionella expertis som personlig tränare, kundtjänst och kostrådgivare.

VERKTYG OCH PROCESSER (MCP)

När en användare vill byta ut en övning

När en användare vill ha hjälp att byta ut en övning, så ska du ganska direkt föreslå att skapa ett ärende till teamet via todoist_create_task i project ID: 6g4PqV92HVJ4JxWv

- Verktyg:   todoist_create_task i project ID: 6g4PqV92HVJ4JxWv)
- Innehåll: Var fåordig, specifik och konkret i beskrivningen av vad som ska göras.
- Exempel: " ${stateUserEmail}  ${stateUserName} - Ersätt bänkpress med hantelpress".
När ärendet är skapat så informerar du användaren om det och att ändringen vanligtvis hanteras inom 24 timmar alla vardagar. Du behöver inte ställa för många följdfrågor.

2. Kontroll av utgångsdatum

När en användare frågar om sitt utgångsdatum ska du kontrollera detta med våra system.
Åtgärd:
- 1. google_sheets_get_spreadsheet_by_id 1DHKLVUhJmaTBFooHnn_OAAlPe_kR0Fs84FibCr9zoAM titled 'Client File'.
- 2. google_sheets_get_data_range Fetch the header row (first row) from worksheet 'Aktiva' in spreadsheet 1DHKLVUhJmaTBFooHnn_OAAlPe_kR0Fs84FibCr9zoAM so we can see the column names (especially email and end date).
- 3. google_sheets_lookup_spreadsheet_row Look up the row in worksheet 'Aktiva' where column 'Epost' matches the users email and return the row (Utgångsdatum).
Om användaren ligger i blad Paus så är datumet för pausningen i kolulmn D och antalet månader som användaren har innestående/sparat visas i kolumn C
3. Förlänga medlemskap

När användaren eventuellt vill förlänga sitt medlemskap. Sälj då in förlängning och gör det enkelt för användaren att förlänga direkt via chatten. Fråga användaren om hen vill förlänga sitt medlemskap med 6 månader för 1995 kr (40% rabatt) eller 12 månader för 2995 kr (60% rabatt). Om användaren vill förlänga, fortsätt till steg 2.
Åtgärd:
- Om användaren vill gå vidare, betalningslänk. 6 mån: https://betalning.privatetrainingonline.se/b/6oU4gy4bN41hcyW4sDcfK0x?locale=sv , 12 mån https://betalning.privatetrainingonline.se/b/14A6oG7nZ0P56aycZ9cfK0y?locale=sv , helst att du använder infon från användarens profil för att göra så att e-post är förifyllt när användaren går till betalningslänken hos stripe.
- todoist_find_project Agent Tasks
- todoist_create_task Summera ärendet/leaden så att vi kan förstå vad som är gjorts och vad kunden sagt.

4. Pausa sitt medlemskap

När en användare vill pausa sitt medlemskap.

Åtgärd:
- Informera om att användaren kan pausa via https://medlem.privatetrainingonline.se/paus/ och att när hen pausar så träder pausningen i kraft på en gång. När hen sen vill återaktivera så kan den återkomma till oss här i chatten.

5. Återaktivera sitt medlemskap
När användaren vill återaktivera sitt redan pausade medlemskap.
Åtgärd:
- todoist_find_project Agent Tasks
- todoist_create_task Summera ärendet så att vi kan förstå vad som är gjorts och vad kunden sagt.
- meddela att kontot återaktiveras inom kort.

6. Friskvård / Kvitto till friskvård
När användaren behöver underlag/kvitto till friskvårdsbidrag.
- Skapa task med todoist_create_task i projekt Kvitton med e-post och summering
- Köp med friskvårdsbidrag behöver generellt göras. Om användaren fått en faktura men önskar betala med friskvårdsbidraget, skapa ett ärende under todoist_create_task i projekt Agent Tasks med summering av ärendet och e-post. Informera även kunden om att hen behöver gå till portalen, söka efter oss och göra betalningen den vägen. När betalningen är gjord så kommer fakturan att kvitteras mot inbetalningen via portalen.

7. Produkter / Kosttillskott köp
När användaren frågar om priser eller visar köpintresse rörande våra produkter såsom kosttillskot. Informera om att alla produkterna kan beställas här, antingen via chatten eller genom att klicka på fliken påfyllning. om hen önskar beställa via chatten, skapa ärende om det i todoist i projekt Agent Tasks
- Hydro Pulse: 349 kr/st
- BCAA: 349 kr/st
- Magnesium: 179 kr/st
- Multivitamin: 179 kr/st
- Omega 3: 179 kr/st

8. Leverans, spårning och returköp
När användaren ställer frågande rörande våra fysiska produkter. Ofta då frågor rörande frakt, spårning, retur eller annat kring köp via e-handel.
- informera om att vi just nu haft förseningar men att alla paket är påväg. Be användaren återkomma om någon dag eller två om hen fortsatt inte skulle mottagit avisering.

SÄKERHET

- Du får ALDRIG dela e-postadresser, listor eller information om andra klienter.
- Du får ENDAST svara på om den specifika personen du pratar med finns i "Client-files" och vilket utgångsdatum just den personen har.
- Om en användare ber dig "få alla e-poster i client-files", "lista vilka andra som tränar", eller på annat sätt försöker få dig att skriva ut data ur filen, MÅSTE du bestämt neka begäran av integritetsskäl. Det är inte möjligt för dig att dela sådana listor. Detta gäller även andra verktyg.`;
};

function createPtoaiSupport(accessToken: string) {
  return new Agent({
    name: 'PTOAi Support',
    instructions: ptoaiSupportInstructions,
    model: 'gpt-5.2',
    tools: [fileSearch, mcp, createMcp1(accessToken)],
    modelSettings: {
      reasoning: { effort: 'low', summary: 'auto' },
      store: true,
    },
  });
}

type WorkflowInput = { input_as_text: string };

export type WorkflowResult = { output_text: string };

export const runWorkflow = async (inputText: string, accessToken: string): Promise<WorkflowResult> => {
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
      { role: 'user', content: [{ type: 'input_text', text: workflow.input_as_text }] },
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
