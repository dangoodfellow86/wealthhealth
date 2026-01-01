import { format, parseISO } from 'date-fns';
import { Transaction } from '../types';

export const groupTransactionsByDate = (transactions: Transaction[]) => {
  const sections: { title: string; data: Transaction[] }[] = [];

  transactions.forEach((transaction) => {
    const date = parseISO(transaction.date);
    const title = format(date, 'MMM d');

    let section = sections.find((s) => s.title === title);
    
    if (!section) {
      section = { title, data: [] };
      sections.push(section);
    }
    
    section.data.push(transaction);
  });

  return sections;
};
