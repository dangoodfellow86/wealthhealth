import { format } from 'date-fns';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebaseConfig';
import { CycleOverride, RecurringItem, Transaction, UserProfile } from '../types';
import { getCurrentPayPeriod } from '../utils/dateLogic';

export interface DashboardData {
  leftToSpend: number;
  baseIncome: number;
  totalRecurring: number;
  totalSpent: number;
  currencyCode: string;
  currencySymbol: string;
  currentCycle: {
    startDate: Date;
    endDate: Date;
  } | null;
  transactions: Transaction[];
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  progress: number; // 0 to 1
  refetch: () => Promise<void>;
}

export const useDashboardData = (): DashboardData => {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData>({
    leftToSpend: 0,
    baseIncome: 0,
    totalRecurring: 0,
    totalSpent: 0,
    currencyCode: 'USD',
    currencySymbol: '$',
    currentCycle: null,
    transactions: [],
    userProfile: null,
    loading: true,
    error: null,
    progress: 0,
    refetch: async () => {},
  });

  const fetchData = useCallback(async () => {
    if (!user) {
      setData(prev => ({ ...prev, loading: false, error: 'User not authenticated' }));
      return;
    }

    try {
      setData(prev => ({ ...prev, loading: true, error: null }));

      // 1. Fetch User Profile
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        throw new Error('User profile not found');
      }

      const userProfile = userDocSnap.data() as UserProfile;
      const { financialSettings, preferences } = userProfile;

      // 2. Calculate Current Pay Period
      const currentCycle = getCurrentPayPeriod(financialSettings);
      const { startDate, endDate } = currentCycle;

      // 2.5 Fetch Cycle Override
      const cycleKey = format(startDate, 'yyyy-MM-dd');
      const overrideDocRef = doc(db, 'users', user.uid, 'cycle_overrides', cycleKey);
      const overrideDocSnap = await getDoc(overrideDocRef);
      
      let income = financialSettings.baseIncome;
      if (overrideDocSnap.exists()) {
        const overrideData = overrideDocSnap.data() as CycleOverride;
        income = overrideData.amount;
      }

      // 3. Fetch Recurring Items
      const recurringCollRef = collection(db, 'users', user.uid, 'recurring_items');
      const recurringSnapshot = await getDocs(recurringCollRef);
      const recurringItems = recurringSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as RecurringItem[];

      // Filter active recurring items and sum them
      const activeRecurringItems = recurringItems.filter(item => item.isActive);
      const totalRecurring = activeRecurringItems.reduce((sum, item) => sum + item.amount, 0);

      // 4. Fetch Transactions
      // We'll fetch all transactions and filter in memory for now to avoid complex indexes, 
      // or we can try to filter by date if we have a standard date format.
      // Transactions store date as ISO String.
      // Firestore string comparison works for ISO dates.
      const transactionsCollRef = collection(db, 'users', user.uid, 'transactions');
      const q = query(
        transactionsCollRef,
        where('date', '>=', startDate.toISOString()),
        where('date', '<=', endDate.toISOString())
      );
      
      // Note: If 'date' is stored as just YYYY-MM-DD, we might need to be careful.
      // The type definition says ISO String.
      // Let's assume standard ISO format.
      
      const transactionsSnapshot = await getDocs(q);
      const transactions = transactionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Transaction[];

      // Filter expenses (amount is positive, type is 'expense')
      const expensesInPeriod = transactions.filter(t => t.type === 'expense');
      const totalSpent = expensesInPeriod.reduce((sum, t) => sum + t.amount, 0);

      // Filter ad-hoc income
      const incomeInPeriod = transactions.filter(t => t.type === 'income');
      const totalAdHocIncome = incomeInPeriod.reduce((sum, t) => sum + t.amount, 0);

      // 5. Calculate Left to Spend
      // Formula: LeftToSpend = (BaseIncome + AdHocIncome) - (SumOfActiveRecurringBills) - (SumOfExpensesInPeriod)
      // Note: income is now potentially overridden (calculated above)
      const leftToSpend = (income + totalAdHocIncome) - totalRecurring - totalSpent;

      // Calculate Progress
      // Progress = Spent / Disposable Income?
      // Or Progress = (TotalRecurring + TotalSpent) / Income?
      // "Show a progress bar indicating how much of the disposable income has been spent."
      // Disposable Income usually means Income - Fixed Bills.
      // So Disposable = Income - TotalRecurring.
      // Spent = TotalSpent.
      // Progress = TotalSpent / (Income - TotalRecurring).
      
      let progress = 0;
      const disposableIncome = income - totalRecurring;
      if (disposableIncome > 0) {
        progress = totalSpent / disposableIncome;
      } else if (totalSpent > 0) {
        progress = 1; // Over budget or 0 disposable
      }

      setData({
        leftToSpend,
        baseIncome: income,
        totalRecurring,
        totalSpent,
        currencyCode: preferences?.currencyCode || 'USD',
        currencySymbol: preferences?.currencySymbol || '$',
        currentCycle,
        transactions,
        userProfile,
        loading: false,
        error: null,
        progress: Math.min(Math.max(progress, 0), 1), // Clamp between 0 and 1
        refetch: fetchData,
      });

    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setData(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return data;
};
