export type LeadContact = {
  profile_url?: string | null;
  dm_link?: string | null;
  email?: string | null;
  phone?: string | null;
  post_url?: string | null;
  application_url?: string | null;
};

export type Lead = {
  id: string;
  business: string;
  need: string;
  why_suits: string;
  contact: LeadContact;
  recency: string;
  platform: string;
  remote_eligible_pak: boolean;
  validation_passed: Record<string, boolean> | null;
  score: number;
  pitch_angle: string | null;
  case_study: string | null;
  created_at: string;
  updated_at: string;
};

export const PLATFORMS = [
  'All',
  'Google Maps',
  'Instagram',
  'Threads',
  'Facebook',
  'Job Boards',
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
