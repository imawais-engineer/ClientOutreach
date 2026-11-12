export type LeadContact = {
  profile_url?: string | null;
  dm_link?: string | null;
  email?: string | null;
  phone?: string | null;
  post_url?: string | null;
  application_url?: string | null;
  website?: string | null;
};

export const LIFECYCLE = [
  'discovered',
  'researching',
  'qualified',
  'ready_for_outreach',
  'contacted',
  'replied',
  'discovery_discussion',
  'proposal_or_pilot',
  'won',
  'lost',
  'nurture',
  'disqualified',
  'do_not_contact',
] as const;

export type LeadStatus = (typeof LIFECYCLE)[number];

export const STATUS_LABELS: Record<LeadStatus, string> = {
  discovered: 'Discovered',
  researching: 'Researching',
  qualified: 'Qualified',
  ready_for_outreach: 'Ready',
  contacted: 'Contacted',
  replied: 'Replied',
  discovery_discussion: 'Discovery',
  proposal_or_pilot: 'Proposal',
  won: 'Won',
  lost: 'Lost',
  nurture: 'Nurture',
  disqualified: 'Disqualified',
  do_not_contact: 'Do not contact',
};

export type EvidenceEntry = {
  source?: string | null;
  source_type?: string | null;
  url?: string | null;
  observed_at?: string | null;
  summary?: string | null;
  classification?: string | null;
  tier?: string | null;
  verification?: string | null;
};

export type ContactEntry = {
  name?: string | null;
  role?: string | null;
  role_evidence?: string | null;
  channel?: string | null;
  verification?: string | null;
};

export type ScoreEntry = { score: number; weight: number; why?: string | null };

export type LeadDetails = {
  evidence?: EvidenceEntry[];
  contacts?: ContactEntry[];
  scores?: Record<string, ScoreEntry>;
  communication?: Record<string, unknown>[];
  change_log?: Record<string, unknown>[];
  commercial_terms?: Record<string, unknown>;
  observed_evidence?: string | null;
  opportunity_hypothesis?: string | null;
  confirmed_requirement?: string | null;
  confirmed_buying_intent?: string | null;
  confirmed_pain?: string | null;
  missing_information?: string | null;
  next_research_step?: string | null;
  next_action?: string | null;
  reply_classification?: string | null;
  contact_eligibility?: string | null;
  suggested_follow_up_message?: string | null;
  last_message_summary?: string | null;
  verification_status?: string | null;
  commercial_suitability?: string | null;
  [key: string]: unknown;
};

export type Lead = {
  id: string;
  business: string;
  business_key: string;
  need: string;
  why_suits: string | null;
  relevant_service: string | null;
  contact: LeadContact;
  recency: string;
  platform: string;
  source: string;
  city: string | null;
  country: string | null;
  remote_eligible_pak: boolean;
  validation_passed: Record<string, boolean> | null;
  score: number;
  weighted_score: number | null;
  classification: string | null;
  evidence_level: string | null;
  pitch_angle: string | null;
  case_study: string | null;
  status: LeadStatus;
  hidden: boolean;
  opt_out: boolean;
  human_review_required: boolean;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
  outcome: string | null;
  outcome_at: string | null;
  category: string;
  details?: LeadDetails;
  created_at: string;
  updated_at: string;
};

export const PLATFORMS = [
  'All',
  'Google Maps',
  'Job Boards',
  'Instagram',
  'Threads',
  'Facebook',
  'LinkedIn',
  'Directory',
  'Freelance Platform',
  'Community',
  'Referral',
  'Partnership',
  'Startup Network',
  'Competitor Signal',
  'Agency Partner',
] as const;

export type PlatformFilter = (typeof PLATFORMS)[number];

export type RecencyFilter = 'all' | '3' | '7';

export const OUTREACH_TEMPLATE = (lead: {
  need: string;
  case_study?: string | null;
}) =>
  `Hey, saw you need ${lead.need} - I built ${
    lead.case_study || 'a similar automation'
  } - 90 sec Loom for you? - imawais.engineer/projects`;

/** Scraped business names carry long `A - B - C` tails; keep the recognisable head. */
export const shortBusiness = (business: string, max = 60): string => {
  const head = business.split(/\s+[-–|]\s+/)[0].trim();
  const base = head.length >= 3 ? head : business.trim();
  return base.length > max ? `${base.slice(0, max - 1).trimEnd()}…` : base;
};

/**
 * What the business actually does. The pipeline stores the business description
 * in the tail of `why_suits` (after "Evidence:"), so prefer that and fall back
 * to the opportunity text rather than inventing a summary.
 */
export const businessDescription = (lead: {
  why_suits?: string | null;
  need: string;
}): string => {
  const why = (lead.why_suits ?? '').trim();
  const [, evidence] = why.split(/Evidence:/i);
  if (evidence && evidence.trim()) return evidence.trim();
  return why || lead.need;
};

/** Skill labels offered only when the lead's own text points at them. */
const SKILL_RULES: Array<[RegExp, string]> = [
  [/whatsapp/i, 'WhatsApp Automation'],
  [/n8n|make\.com|zapier|workflow/i, 'n8n Workflow Automation'],
  [/ai agent|agentic|llm|gpt|openai|assistant/i, 'AI Agents'],
  [/crm|hubspot|salesforce|pipedrive|crm sync/i, 'CRM Integration'],
  [/lead gen|outbound|prospect|enrich|qualif/i, 'Lead Generation & Qualification'],
  [/api|webhook|integration/i, 'API Integrations'],
  [/web app|website|frontend|e-?commerce|store|shopify/i, 'Web Development'],
  [/email marketing|newsletter|campaign/i, 'Email Automation'],
  [/automation/i, 'AI Automation'],
];

export const skillsForLead = (
  lead: {
    need?: string | null;
    why_suits?: string | null;
    relevant_service?: string | null;
    pitch_angle?: string | null;
  },
  max = 4
): string[] => {
  const text = [lead.relevant_service, lead.why_suits, lead.need, lead.pitch_angle]
    .filter(Boolean)
    .join(' ');
  if (!text.trim()) return [];
  const hits: string[] = [];
  for (const [re, label] of SKILL_RULES) {
    if (re.test(text) && !hits.includes(label)) hits.push(label);
    if (hits.length >= max) break;
  }
  return hits;
};

/** The readable message used for copy-to-clipboard and as the WhatsApp prefill. */
export const composeMessage = (lead: {
  business?: string;
  need: string;
  pitch_angle?: string | null;
  why_suits?: string | null;
  case_study?: string | null;
}): string => {
  const biz = lead.business ? shortBusiness(lead.business, 40) : 'there';
  const need = lead.need.replace(/\s+/g, ' ').trim().replace(/\.$/, '');
  const lines = [
    `Hi ${biz} team — I took a look at your business and noticed one thing I could help with: ${need}.`,
  ];
  const pitch = lead.pitch_angle?.trim();
  if (pitch) lines.push(pitch);
  if (lead.case_study) lines.push(`I've built something very close to this: ${lead.case_study}`);
  lines.push('Happy to send a 90-second walkthrough if that is useful.');
  lines.push('— Imawais · imawais.engineer');
  return lines.join('\n\n');
};

/** Sidebar workflow views. Archived is a hidden-row view, not a lifecycle status. */
export const STATUS_GROUPS = {
  active: ['discovered', 'researching', 'nurture'],
  qualified: ['qualified', 'ready_for_outreach'],
  contacted: ['contacted'],
  replied: ['replied', 'discovery_discussion', 'proposal_or_pilot'],
  won: ['won'],
} as const satisfies Record<string, readonly LeadStatus[]>;

export type StatusGroup = keyof typeof STATUS_GROUPS | 'archived';

export const GROUP_LABELS: Record<StatusGroup, string> = {
  active: 'Active Leads',
  qualified: 'Qualified Leads',
  contacted: 'Contacted Leads',
  replied: 'Replied',
  won: 'Won',
  archived: 'Archived',
};

// Dial codes cover the markets the pipeline targets. Only used to turn a
// locally-formatted number into something wa.me will accept.
const DIAL_CODES: Record<string, string> = {
  US: '1',
  CA: '1',
  GB: '44',
  AU: '61',
  NZ: '64',
  IE: '353',
  PK: '92',
  IN: '91',
  BD: '880',
  LK: '94',
  AE: '971',
  SA: '966',
  QA: '974',
  DE: '49',
  FR: '33',
  NL: '31',
  ES: '34',
  IT: '39',
  PT: '351',
  SG: '65',
  MY: '60',
  ID: '62',
  PH: '63',
  TH: '66',
  VN: '84',
  ZA: '27',
  NG: '234',
  KE: '254',
  EG: '20',
  BR: '55',
  MX: '52',
  TR: '90',
};

/**
 * Digits-only international number for wa.me, or null when the scraped phone
 * cannot be made dialable. Scraped numbers are often local format (`0300…`,
 * `(415) 555-0132`), which wa.me rejects, so the lead's country supplies the
 * dial code when the number does not already carry one.
 */
export const whatsappNumber = (
  phone?: string | null,
  country?: string | null
): string | null => {
  if (!phone) return null;
  let digits = phone.replace(/[^\d+]/g, '').replace(/\+/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  digits = digits.replace(/\D/g, '');
  if (!digits) return null;

  const dial = country ? DIAL_CODES[country.trim().toUpperCase()] : undefined;
  if (dial && digits.startsWith('0')) {
    digits = dial + digits.replace(/^0+/, '');
  } else if (dial && digits.length <= 10) {
    digits = dial + digits;
  }

  if (digits.length < 7 || digits.length > 15) return null;
  return digits;
};

/** `https://wa.me/<number>?text=…`, or null when there is no usable number. */
export const whatsappLink = (
  phone?: string | null,
  country?: string | null,
  text?: string | null
): string | null => {
  const number = whatsappNumber(phone, country);
  if (!number) return null;
  const base = `https://wa.me/${number}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
};
