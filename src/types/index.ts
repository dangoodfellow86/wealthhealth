export enum PayFrequency {
  WEEKLY = 'WEEKLY',
  BI_WEEKLY = 'BI_WEEKLY', // Every 2 weeks
  FOUR_WEEKLY = 'FOUR_WEEKLY', // Every 4 weeks
  MONTHLY_SPECIFIC_DATE = 'MONTHLY_SPECIFIC_DATE', // e.g., 25th
  MONTHLY_LAST_WORKING_DAY = 'MONTHLY_LAST_WORKING_DAY',
}

// Placeholder for Firestore Timestamp to avoid direct dependency on firebase SDK in types for now
export type FirestoreTimestamp = { seconds: number; nanoseconds: number } | Date;

export interface UserProfile {
  email: string;
  displayName: string;
  createdAt: FirestoreTimestamp;

  // User Preferences
  preferences: {
    currencyCode: string; // e.g., "GBP", "USD"
    currencySymbol: string; // e.g., "£", "$"
  };

  // The Logic Engine Configuration
  financialSettings: {
    baseIncome: number; // The user's expected take-home pay per cycle
    payFrequency: PayFrequency;

    // Anchors for calculating the cycle
    lastPayDate?: string | null; // ISO String (YYYY-MM-DD). Used for WEEKLY/BI_WEEKLY/4_WEEKLY
    payDayOfMonth?: number | null; // Used for MONTHLY_SPECIFIC_DATE (e.g., 25)

    // Variable Income: Overrides for specific cycles
    incomeOverrides?: {
      [cycleStartDate: string]: number; // Key is YYYY-MM-DD of the cycle start
    };
  };
}

export interface Transaction {
  id: string;
  amount: number; // Positive
  type: 'expense' | 'income';
  category: string; // e.g., "Groceries", "Transport"
  date: string; // ISO String
  note?: string;
  accountId: string; // Link to wallet
  isRecurringInstance: boolean; // True if this was auto-generated from a bill
}

export type BillFrequency = 'WEEKLY' | 'BI_WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

export interface RecurringItem {
  id: string;
  title: string; // e.g., "Netflix"
  amount: number;
  isActive: boolean;
  category: string; // "Bills"
  frequency?: BillFrequency; // Defaults to 'MONTHLY'
  dayOfMonth?: number; // e.g., 15
  dueMonth?: number; // 1-12 (for ANNUAL and QUARTERLY bills)
}

export interface CycleOverride {
  startDate: string; // ISO String, acts as ID
  amount: number;
}

export interface PlannedExpense {
  id: string;
  title: string;
  amount: number;
  targetDate: string; // ISO String (YYYY-MM-DD or full ISO)
  category: string;
  note?: string;
  isCompleted?: boolean;
}
