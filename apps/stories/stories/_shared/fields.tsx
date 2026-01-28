import type { FieldDefinition } from '@kuruwic/tokenized-search-input/utils';
import { Calendar, Clock, Flag, Globe, Search, Tag, User } from 'lucide-react';

// Basic fields for simple examples
export const BASIC_FIELDS: FieldDefinition[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    operators: ['is', 'is_not'],
    enumValues: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'pending', label: 'Pending' },
      { value: 'archived', label: 'Archived' },
    ],
    icon: <Tag className="w-full h-full" />,
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'enum',
    operators: ['is', 'is_not'],
    enumValues: [
      { value: 'critical', label: 'Critical' },
      { value: 'high', label: 'High' },
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' },
    ],
    icon: <Flag className="w-full h-full" />,
  },
  {
    key: 'assignee',
    label: 'Assignee',
    type: 'string',
    operators: ['is', 'contains', 'starts_with', 'ends_with'],
    icon: <User className="w-full h-full" />,
  },
];

// Fields with all string operators
export const STRING_FIELDS: FieldDefinition[] = [
  {
    key: 'title',
    label: 'Title',
    type: 'string',
    operators: ['is', 'is_not', 'contains', 'starts_with', 'ends_with'],
    allowSpaces: true,
    icon: <Search className="w-full h-full" />,
  },
  {
    key: 'description',
    label: 'Description',
    type: 'string',
    operators: ['contains'],
    allowSpaces: true,
  },
];

// Date and datetime fields
export const DATE_FIELDS: FieldDefinition[] = [
  {
    key: 'created',
    label: 'Created',
    type: 'date',
    operators: ['gt', 'lt', 'gte', 'lte'],
    icon: <Calendar className="w-full h-full" />,
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
    icon: <Clock className="w-full h-full" />,
    operatorLabels: {
      gt: { display: 'after', select: 'after' },
      lt: { display: 'before', select: 'before' },
    },
    timeRequired: false,
  },
];

// Country field for custom suggestions examples
export const COUNTRY_FIELD: FieldDefinition = {
  key: 'country',
  label: 'Country',
  type: 'string',
  operators: ['is'],
  icon: <Globe className="w-full h-full" />,
  tokenLabelDisplay: 'hidden',
  hideSingleOperator: true,
};

// Tag field for simple tag input examples
export const TAG_FIELD: FieldDefinition = {
  key: 'tag',
  label: 'Tag',
  type: 'string',
  operators: ['is'],
  icon: <Tag className="w-full h-full" />,
  tokenLabelDisplay: 'hidden',
  hideSingleOperator: true,
};

// User field for validation examples
export const USER_FIELD: FieldDefinition = {
  key: 'user',
  label: 'User',
  type: 'string',
  operators: ['is'],
  icon: <User className="w-full h-full" />,
};

// All fields combined for playground
export const ALL_FIELDS: FieldDefinition[] = [
  ...BASIC_FIELDS,
  ...STRING_FIELDS.filter((f) => f.key !== 'title'),
  {
    key: 'title',
    label: 'Title',
    type: 'string',
    operators: ['contains'],
    allowSpaces: true,
    icon: <Search className="w-full h-full" />,
  },
  ...DATE_FIELDS,
];

// Fields with different tokenLabelDisplay options
export const TOKEN_DISPLAY_FIELDS: {
  auto: FieldDefinition[];
  iconOnly: FieldDefinition[];
  hidden: FieldDefinition[];
} = {
  auto: [
    {
      key: 'status',
      label: 'Status',
      type: 'enum',
      operators: ['is', 'is_not'],
      enumValues: ['active', 'inactive', 'pending'],
      icon: <Tag className="w-full h-full" />,
      tokenLabelDisplay: 'auto',
    },
    {
      key: 'priority',
      label: 'Priority',
      type: 'enum',
      operators: ['is'],
      enumValues: ['high', 'medium', 'low'],
      icon: <Flag className="w-full h-full" />,
      tokenLabelDisplay: 'auto',
    },
  ],
  iconOnly: [
    {
      key: 'status',
      label: 'Status',
      type: 'enum',
      operators: ['is', 'is_not'],
      enumValues: ['active', 'inactive', 'pending'],
      icon: <Tag className="w-full h-full" />,
      tokenLabelDisplay: 'icon-only',
    },
    {
      key: 'priority',
      label: 'Priority',
      type: 'enum',
      operators: ['is'],
      enumValues: ['high', 'medium', 'low'],
      icon: <Flag className="w-full h-full" />,
      tokenLabelDisplay: 'icon-only',
    },
  ],
  hidden: [
    {
      key: 'tag',
      label: 'Tag',
      type: 'enum',
      operators: ['is'],
      enumValues: ['react', 'typescript', 'javascript', 'vue'],
      icon: <Tag className="w-full h-full" />,
      tokenLabelDisplay: 'hidden',
      hideSingleOperator: true,
    },
  ],
};

// Fields with immutable tokens
export const IMMUTABLE_COUNTRY_FIELD: FieldDefinition = {
  ...COUNTRY_FIELD,
  immutable: true,
};

// Simple fields for prepend/append mode demos (status + assignee)
export const SUGGESTION_DEMO_FIELDS: FieldDefinition[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    operators: ['is'],
    enumValues: ['active', 'inactive', 'pending'],
    icon: <Tag className="w-full h-full" />,
  },
  {
    key: 'assignee',
    label: 'Assignee',
    type: 'string',
    operators: ['is'],
    icon: <User className="w-full h-full" />,
  },
];

// Combined fields for paginated prepend/append demos
export const PAGINATED_DEMO_FIELDS: FieldDefinition[] = [...SUGGESTION_DEMO_FIELDS, COUNTRY_FIELD];

// Status field with multiple operators for unknown fields demos
export const KNOWN_STATUS_FIELD: FieldDefinition = {
  key: 'status',
  label: 'Status',
  type: 'enum',
  operators: ['is'],
  enumValues: ['active', 'inactive', 'pending'],
  icon: <Tag className="w-full h-full" />,
};

// Mixed fields for unknown fields demos
export const MIXED_KNOWN_FIELDS: FieldDefinition[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    operators: ['is', 'is_not'],
    enumValues: ['active', 'inactive', 'pending'],
    icon: <Tag className="w-full h-full" />,
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'enum',
    operators: ['is'],
    enumValues: [
      { value: 'high', label: 'High' },
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' },
    ],
    icon: <Flag className="w-full h-full" />,
  },
];

// Fields with categories for dropdown styling demos
export const CATEGORIZED_FIELDS: FieldDefinition[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    category: 'Filters',
    operators: ['is', 'is_not'],
    enumValues: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'pending', label: 'Pending' },
    ],
    icon: <Tag className="w-full h-full" />,
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'enum',
    category: 'Filters',
    operators: ['is', 'is_not'],
    enumValues: [
      { value: 'high', label: 'High' },
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' },
    ],
    icon: <Flag className="w-full h-full" />,
  },
  {
    key: 'assignee',
    label: 'Assignee',
    type: 'string',
    category: 'People',
    operators: ['is', 'contains'],
    icon: <User className="w-full h-full" />,
  },
  {
    key: 'created',
    label: 'Created',
    type: 'date',
    category: 'Dates',
    operators: ['gt', 'lt'],
    icon: <Calendar className="w-full h-full" />,
    operatorLabels: {
      gt: { display: 'after', select: 'after' },
      lt: { display: 'before', select: 'before' },
    },
  },
];

// Enum status field with labeled values for validation demos
export const ENUM_STATUS_FIELD: FieldDefinition = {
  key: 'status',
  label: 'Status',
  type: 'enum',
  operators: ['is'],
  enumValues: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'pending', label: 'Pending' },
    { value: 'archived', label: 'Archived' },
  ],
  icon: <Tag className="w-full h-full" />,
};
