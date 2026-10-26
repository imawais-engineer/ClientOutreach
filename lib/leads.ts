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
