Project Context: WealthHealth (Personal Finance App)

1. Project OverviewWe are building a React Native mobile application focused on Financial Health, not just expense tracking. The core value proposition is the "Left to Spend" dashboard, which calculates disposable income based on the user's specific pay cycle and fixed recurring bills.Key Goals:Frictionless transaction logging.Support for complex Pay Cycles (Weekly, Bi-Weekly, Monthly, Last Working Day).Automatic handling of Recurring Bills (Subscriptions/Rent).Offline-first capability using Firebase.

2. Tech StackFramework: React Native (Expo Managed Workflow).Language: TypeScript.Backend/DB: Firebase (Auth & Firestore).State Management: React Context API (for User/Auth state) + Local Component State.Styling: React Native Paper or StyleSheet.Date Handling: date-fns (Crucial for pay cycle logic).Navigation: Expo Router (File-based routing).

3. Data Models (Firestore Schema)The database is Read-Heavy. Data is scoped to the user via Sub-collections to ensure security rules are easily applied (request.auth.uid == userId).Collection: usersDocument ID: auth.uidTypeScriptinterface UserProfile {
  email: string;
  displayName: string;
  createdAt: FirebaseFirestore.Timestamp;
  
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
    lastPayDate?: string; // ISO String (YYYY-MM-DD). Used for WEEKLY/BI_WEEKLY/4_WEEKLY
    payDayOfMonth?: number; // Used for MONTHLY_SPECIFIC_DATE (e.g., 25)
  };
}

enum PayFrequency {
  WEEKLY = 'WEEKLY',
  BI_WEEKLY = 'BI_WEEKLY', // Every 2 weeks
  FOUR_WEEKLY = 'FOUR_WEEKLY', // Every 4 weeks
  MONTHLY_SPECIFIC_DATE = 'MONTHLY_SPECIFIC_DATE', // e.g., 25th
  MONTHLY_LAST_WORKING_DAY = 'MONTHLY_LAST_WORKING_DAY'
}
Sub-Collection: transactionsPath: users/{uid}/transactions/{txId}TypeScriptinterface Transaction {
  id: string;
  amount: number; // Positive
  type: 'expense' | 'income';
  category: string; // e.g., "Groceries", "Transport"
  date: string; // ISO String
  note?: string;
  accountId: string; // Link to wallet
  isRecurringInstance: boolean; // True if this was auto-generated from a bill
}
Sub-Collection: recurring_itemsPath: users/{uid}/recurring_items/{itemId}Stores the "Templates" for bills.TypeScriptinterface RecurringItem {
  id: string;
  title: string; // e.g., "Netflix"
  amount: number;
  isActive: boolean;
  category: string; // "Bills"
}
4. Core Business Logic

A. The "Left to Spend" FormulaThe dashboard must calculate the user's available funds for the Current Pay Cycle.$$LeftToSpend = (CycleIncome) - (SumOfRecurringBills) - (SumOfAdHocSpending)$$Cycle Income: The baseIncome defined in financialSettings.Sum of Recurring: Sum of all active items in recurring_items (Subtract these immediately at the start of the cycle, essentially "reserving" the money).Sum of Ad-Hoc: Sum of all transactions falling within the current cycle date range where type == 'expense' AND isRecurringInstance == false.
B. Determining the "Current Pay Cycle"Use date-fns to determine the startDate and endDate of the current view based on financialSettings.payFrequency.Weekly/Bi-Weekly/4-Weekly:Take lastPayDate.Add weeks iteratively until the date is in the future.The previous iteration is startDate.Monthly (Specific Date):If Today >= payDayOfMonth, startDate is this month's pay day.Else, startDate is last month's pay day.Monthly (Last Working Day):Calculate the last weekday of the current month.Adjust logic to find if we are before or after that date.

5. The Onboarding Flow (Wizard)The app must not land on the dashboard immediately. It requires a setup wizard upon first login.Welcome & Name: displayNameCurrency: currencyCode, currencySymbolPay Cycle Frequency: Select from Enum PayFrequency.Cycle Anchor:If Weekly/Bi-Weekly: Date Picker ("When was your last pay day?")If Monthly: Number Input ("Which day?") or Toggle ("Last Working Day")Income: Input baseIncome (Wage).

6. Directory Structure (Suggested)/src
  /components     # Reusable UI (Buttons, Cards, Inputs)
  /screens        # Screen components (Dashboard, Onboarding, AddTransaction)
  /navigation     # React Navigation setup
  /services       # Firebase interactions (Auth, Firestore wrappers)
  /hooks          # Custom hooks (useAuth, useTransactions, useCycleCalculator)
  /utils          # Helper functions (date logic, currency formatting)
  /types          # TypeScript interfaces
7. Development GuidelinesStrict Typing: Always use the Interfaces defined in Section 3.Async Handling: Handle Loading and Error states for all Firestore operations.Date-fns: Use date-fns for all date math. Do not use Moment.js.Expo: Use Expo SDK components (e.g., expo-linear-gradient, expo-status-bar) where appropriate.