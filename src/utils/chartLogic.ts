import { Transaction } from '../types';

export interface ChartData {
  value: number;
  color: string;
  text: string;
  category: string;
}

const COLORS = [
  '#FB923C', // Soft Orange
  '#4F46E5', // Indigo
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#6366F1', // Indigo Light
  '#8B5CF6', // Violet
  '#14B8A6', // Teal
];

export const groupExpensesByCategory = (transactions: Transaction[]): ChartData[] => {
  const expenses = transactions.filter(t => t.type === 'expense');
  const categoryMap: Record<string, number> = {};

  expenses.forEach(t => {
    if (categoryMap[t.category]) {
      categoryMap[t.category] += t.amount;
    } else {
      categoryMap[t.category] = t.amount;
    }
  });

  return Object.keys(categoryMap).map((category, index) => ({
    value: categoryMap[category],
    color: COLORS[index % COLORS.length],
    text: category,
    category: category
  })).sort((a, b) => b.value - a.value);
};
