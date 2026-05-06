import { clsx, type ClassValue } from 'clsx';

const cn = (...inputs: ClassValue[]): string => clsx(inputs);
export { cn };
