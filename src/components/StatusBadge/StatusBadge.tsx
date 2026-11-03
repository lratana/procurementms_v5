import React from 'react';

interface StatusBadgeProps {
  status: string | null | undefined;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  if (!status) return null;

  const s = status.trim();

  // Green / Success
  if (
    s === 'កំពុងមានសុពលភាព' ||
    s === 'កំពុងធានា' ||
    s === 'បានបញ្ចប់' ||
    s === 'ប្រគល់រួចរាល់' ||
    s === 'active' ||
    s === 'Active'
  ) {
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 ${className}`}
      >
        <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-emerald-500"></span>
        {s === 'active' ? 'សកម្ម' : s}
      </span>
    );
  }

  // Orange / Warning
  if (
    s === 'កំពុងអនុវត្ត' ||
    s === 'កំពុងដំណើរការ' ||
    s === 'ជិតផុតកំណត់' ||
    s.startsWith('ដំណាក់កាលទី') ||
    s === 'In Progress'
  ) {
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 ${className}`}
      >
        <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-amber-500"></span>
        {s}
      </span>
    );
  }

  // Red / Danger
  if (
    s === 'ផុតកំណត់' ||
    s === 'disabled' ||
    s === 'inactive' ||
    s === 'មិនទាន់ប្រគល់' ||
    s === 'Expired'
  ) {
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200 ${className}`}
      >
        <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-rose-500"></span>
        {s === 'disabled' ? 'ផ្អាកដំណើរការ' : s === 'inactive' ? 'អសកម្ម' : s}
      </span>
    );
  }

  // Blue / Info (Default)
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200 ${className}`}
    >
      <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-blue-500"></span>
      {s === 'admin' ? 'អ្នកគ្រប់គ្រង (Admin)' : s === 'editor' ? 'អ្នកកែសម្រួល (Editor)' : s === 'viewer' ? 'អ្នកមើល (Viewer)' : s}
    </span>
  );
}
