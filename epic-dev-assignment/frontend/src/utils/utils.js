import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function daysRemaining(endDate) {
  if (!endDate) return 0;
  const now = new Date();
  const end = new Date(endDate);
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
}

export function daysBetween(start, end) {
  if (!start || !end) return 0;
  return Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24));
}

export function getDateRange(start, end) {
  const dates = [];
  const current = new Date(start);
  const endDate = new Date(end);
  while (current <= endDate) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}
