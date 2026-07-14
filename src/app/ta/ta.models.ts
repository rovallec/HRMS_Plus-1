export type TaFieldType = 'short_text' | 'long_text' | 'rich_text' | 'number' | 'phone' | 'email' | 'single_choice' | 'multiple_choice' | 'pdf' | 'image';

export interface TaField {
  id: string;
  label: string;
  type: TaFieldType;
  required: boolean;
  section: string;
  placeholder?: string;
  options: string[];
  showInTable: boolean;
  groupId: string | null;
}

export interface TaForm {
  id?: number;
  slug: string;
  title: string;
  description: string;
  layout: 'single' | 'sections' | 'steps';
  isPublic: boolean;
  requireAuth: boolean;
  allowGeolocation: boolean;
  restrictCountries: boolean;
  allowedCountries: string[];
  availableUntil: string | null;
  timeLimitMinutes: number | null;
  maxAttempts: number | null;
  status: 'draft' | 'published' | 'closed';
  fields: TaField[];
  questionGroups: TaQuestionGroup[];
  createdAt?: string;
}

export interface TaQuestionGroup { id: string; name: string; section: string; mode: 'all' | 'random'; questionsToShow: number | null; }

export interface TaSubmission {
  id: number;
  formId: number;
  submittedAt: string;
  respondent: string;
  answers: Record<string, unknown>;
  latitude?: number | null;
  longitude?: number | null;
  elapsedSeconds?: number;
}
