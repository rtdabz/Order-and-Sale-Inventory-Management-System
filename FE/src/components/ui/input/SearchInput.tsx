import React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../../lib/utils';

export type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Rendered inside the field on the right (e.g. a keyboard hint). */
  hint?: React.ReactNode;
  autoFocus?: boolean;
  'aria-label'?: string;
};

const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  hint,
  autoFocus,
  'aria-label': ariaLabel,
}) => (
  <div className={cn('relative', className)}>
    <Search
      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
      aria-hidden="true"
    />
    <input
      type="search"
      value={value}
      autoFocus={autoFocus}
      onChange={(event) => onChange(event.target.value ?? '')}
      placeholder={placeholder}
      aria-label={ariaLabel ?? placeholder}
      className={cn(
        'h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 text-sm text-gray-800 placeholder:text-gray-400',
        'transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200',
        'dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-brand-500/30',
        value ? 'pr-9' : hint ? 'pr-16' : 'pr-3',
        '[&::-webkit-search-cancel-button]:hidden'
      )}
    />
    {value ? (
      <button
        type="button"
        onClick={() => onChange('')}
        aria-label="Clear search"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
      >
        <X className="h-4 w-4" />
      </button>
    ) : (
      hint && (
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">
          {hint}
        </span>
      )
    )}
  </div>
);

export default SearchInput;
