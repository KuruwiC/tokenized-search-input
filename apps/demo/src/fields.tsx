import type { FieldDefinition } from '@kuruwic/tokenized-search-input/utils';
import { Calendar, Clock, FileText, Flag, Globe, Search, Tag, User } from 'lucide-react';

export const createSearchFields = (): FieldDefinition[] => [
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    operators: ['is'],
    enumValues: ['active', 'inactive', 'pending'],
    icon: <Tag className="h-full w-full" />,
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'enum',
    operators: ['is', 'is_not'],
    enumValues: ['high', 'medium', 'low'],
    icon: <Flag className="h-full w-full" />,
  },
  {
    key: 'title',
    label: 'Title',
    type: 'string',
    operators: ['contains', 'starts_with', 'ends_with'],
    allowSpaces: true,
    icon: <Search className="h-full w-full" />,
  },
  {
    key: 'created',
    label: 'Created',
    type: 'date',
    operators: ['gt', 'lt', 'gte', 'lte'],
    icon: <Calendar className="h-full w-full" />,
    operatorLabels: {
      gt: { display: 'after', select: 'after' },
      lt: { display: 'before', select: 'before' },
      gte: { display: 'from', select: 'from' },
      lte: { display: 'until', select: 'until' },
    },
  },
  {
    key: 'updated',
    label: 'Updated',
    type: 'datetime',
    operators: ['gt', 'lt'],
    icon: <Clock className="h-full w-full" />,
  },
];

export const TAG_FIELDS: FieldDefinition[] = [
  {
    key: 'tag',
    label: 'Tag',
    type: 'string',
    operators: ['is'],
    tokenLabelDisplay: 'hidden',
    hideSingleOperator: true,
    icon: <Tag className="h-full w-full" />,
  },
];

export const COUNTRY_FIELDS: FieldDefinition[] = [
  {
    key: 'country',
    label: 'Country',
    type: 'string',
    operators: ['is'],
    tokenLabelDisplay: 'hidden',
    hideSingleOperator: true,
    immutable: true,
    icon: <Globe className="h-full w-full" />,
  },
];

export const CLASSIFIER_FIELDS: FieldDefinition[] = [
  {
    key: 'assignee',
    label: 'Assignee',
    type: 'string',
    operators: ['is'],
    icon: <User className="h-full w-full" />,
  },
  {
    key: 'requester',
    label: 'Requester',
    type: 'string',
    operators: ['is'],
    icon: <User className="h-full w-full" />,
  },
  {
    key: 'email',
    label: 'Email',
    type: 'string',
    operators: ['is'],
    icon: <User className="h-full w-full" />,
  },
  {
    key: 'title',
    label: 'Title',
    type: 'string',
    operators: ['contains'],
    allowSpaces: true,
    icon: <FileText className="h-full w-full" />,
  },
];

export const TAGS = [
  'React',
  'TypeScript',
  'JavaScript',
  'Node.js',
  'Next.js',
  'Vue',
  'Svelte',
  'CSS',
  'Rust',
  'Go',
];
