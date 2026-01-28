import type { ReactNode } from 'react';

// Country data with emoji flags
export interface Country {
  code: string;
  name: string;
  emoji: string;
}

const ALL_COUNTRIES: Country[] = [
  { code: 'jp', name: 'Japan', emoji: '🇯🇵' },
  { code: 'us', name: 'United States', emoji: '🇺🇸' },
  { code: 'gb', name: 'United Kingdom', emoji: '🇬🇧' },
  { code: 'fr', name: 'France', emoji: '🇫🇷' },
  { code: 'de', name: 'Germany', emoji: '🇩🇪' },
  { code: 'it', name: 'Italy', emoji: '🇮🇹' },
  { code: 'es', name: 'Spain', emoji: '🇪🇸' },
  { code: 'kr', name: 'South Korea', emoji: '🇰🇷' },
  { code: 'cn', name: 'China', emoji: '🇨🇳' },
  { code: 'au', name: 'Australia', emoji: '🇦🇺' },
  { code: 'ca', name: 'Canada', emoji: '🇨🇦' },
  { code: 'br', name: 'Brazil', emoji: '🇧🇷' },
  { code: 'mx', name: 'Mexico', emoji: '🇲🇽' },
  { code: 'ar', name: 'Argentina', emoji: '🇦🇷' },
  { code: 'in', name: 'India', emoji: '🇮🇳' },
  { code: 'ru', name: 'Russia', emoji: '🇷🇺' },
  { code: 'za', name: 'South Africa', emoji: '🇿🇦' },
  { code: 'ng', name: 'Nigeria', emoji: '🇳🇬' },
  { code: 'eg', name: 'Egypt', emoji: '🇪🇬' },
  { code: 'id', name: 'Indonesia', emoji: '🇮🇩' },
  { code: 'th', name: 'Thailand', emoji: '🇹🇭' },
  { code: 'vn', name: 'Vietnam', emoji: '🇻🇳' },
  { code: 'ph', name: 'Philippines', emoji: '🇵🇭' },
  { code: 'my', name: 'Malaysia', emoji: '🇲🇾' },
  { code: 'sg', name: 'Singapore', emoji: '🇸🇬' },
  { code: 'nz', name: 'New Zealand', emoji: '🇳🇿' },
  { code: 'se', name: 'Sweden', emoji: '🇸🇪' },
  { code: 'no', name: 'Norway', emoji: '🇳🇴' },
  { code: 'dk', name: 'Denmark', emoji: '🇩🇰' },
  { code: 'fi', name: 'Finland', emoji: '🇫🇮' },
  { code: 'nl', name: 'Netherlands', emoji: '🇳🇱' },
  { code: 'be', name: 'Belgium', emoji: '🇧🇪' },
  { code: 'ch', name: 'Switzerland', emoji: '🇨🇭' },
  { code: 'at', name: 'Austria', emoji: '🇦🇹' },
  { code: 'pl', name: 'Poland', emoji: '🇵🇱' },
  { code: 'pt', name: 'Portugal', emoji: '🇵🇹' },
  { code: 'gr', name: 'Greece', emoji: '🇬🇷' },
  { code: 'tr', name: 'Turkey', emoji: '🇹🇷' },
  { code: 'il', name: 'Israel', emoji: '🇮🇱' },
  { code: 'ae', name: 'UAE', emoji: '🇦🇪' },
];

export function generateCountries(count?: number): Country[] {
  if (count === undefined) return [...ALL_COUNTRIES];
  return ALL_COUNTRIES.slice(0, Math.min(count, ALL_COUNTRIES.length));
}

export const COUNTRIES_SMALL = generateCountries(5);
export const COUNTRIES_MEDIUM = generateCountries(12);
export const COUNTRIES_LARGE = generateCountries(40);

// Status data
export interface Status {
  value: string;
  label: string;
  icon?: ReactNode;
}

export const STATUSES: Status[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'pending', label: 'Pending' },
  { value: 'archived', label: 'Archived' },
];

// Priority data
export interface Priority {
  value: string;
  label: string;
}

export const PRIORITIES: Priority[] = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

// Tag data for simple tag inputs
export interface TagItem {
  value: string;
  label: string;
}

export const AVAILABLE_TAGS: TagItem[] = [
  { value: 'react', label: 'React' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'nodejs', label: 'Node.js' },
  { value: 'nextjs', label: 'Next.js' },
  { value: 'vue', label: 'Vue' },
  { value: 'angular', label: 'Angular' },
  { value: 'svelte', label: 'Svelte' },
  { value: 'python', label: 'Python' },
  { value: 'rust', label: 'Rust' },
  { value: 'go', label: 'Go' },
  { value: 'java', label: 'Java' },
];

// Category data for hierarchical examples
export interface Category {
  value: string;
  label: string;
  group: string;
}

export const CATEGORIES: Category[] = [
  { value: 'bug', label: 'Bug', group: 'Type' },
  { value: 'feature', label: 'Feature', group: 'Type' },
  { value: 'enhancement', label: 'Enhancement', group: 'Type' },
  { value: 'documentation', label: 'Documentation', group: 'Type' },
  { value: 'frontend', label: 'Frontend', group: 'Area' },
  { value: 'backend', label: 'Backend', group: 'Area' },
  { value: 'database', label: 'Database', group: 'Area' },
  { value: 'infrastructure', label: 'Infrastructure', group: 'Area' },
];
