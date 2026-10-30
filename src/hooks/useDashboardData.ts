import { differenceInCalendarDays, endOfDay, format, isAfter, isBefore, parseISO, startOfDay } from 'date-fns';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebaseConfig';
import { CycleOverride, PlannedExpense, RecurringItem, Transaction, UserProfile } from '../types';
import { getPayPeriodWithOffset, isBillDueInPeriod, isBillPendingInPeriod } from '../utils/dateLogic';

export type BillDeductionMode = 'reserved' | 'pending';

export interface DashboardData {
  leftToSpend: number;
  baseIncome: number;
  totalRecurring: number;
  pendingRecurring: number;
  totalSpent: number;
  totalPlanned: number;
  currencyCode: string;
  currencySymbol: string;
  currentCycle: {
    startDate: Date;
    endDate: Date;
  } | null;
  transactions: Transaction[];
  plannedExpenses: PlannedExpense[];
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  progress: number; // 0 to 1
  daysRemaining: number;
  safeDailyAllowance: number;
  cycleOffset: number;
  billMode: BillDeductionMode;
  setBillMode: (mode: BillDeductionMode) => void;
  setCycleOffset: (offset: number) => void;
  navigateCycle: (direction: number) => void;
  resetToCurrentCycle: () => void;
  refetch: () => Promise<void>;
}

export const useDashboardData = (initialOffset: number = 0): DashboardData => {
  const { user } = useAuth();
  const [cycleOffset, setCycleOffset] = useState(initialOffset);
  const [billMode, setBillMode] = useState<BillDeductionMode>('reserved');

  const navigateCycle = useCallback((delta: number) => {
    setCycleOffset(prev => prev + delta);
  }, []);

  const resetToCurrentCycle = useCallback(() => {
    setCycleOffset(0);
  }, []);

  const [data, setData] = useState<Omit<DashboardData, 'cycleOffset' | 'setCycleOffset' | 'navigateCycle' | 'resetToCurrentCycle' | 'billMode' | 'setBillMode'>>({
    leftToSpend: 0,
    baseIncome: 0,
    totalRecurring: 0,
    pendingRecurring: 0,
    totalSpent: 0,
    totalPlanned: 0,
    currencyCode: 'USD',
    currencySymbol: '$',
    currentCycle: null,
    transactions: [],
    plannedExpenses: [],
    userProfile: null,
    loading: true,
    error: null,
    progress: 0,
    daysRemaining: 1,
    safeDailyAllowance: 0,
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

      // 2. Calculate Pay Period for active cycleOffset
      const currentCycle = getPayPeriodWithOffset(financialSettings, cycleOffset);
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

      // Filter active recurring items that fall due within this cycle
      const activeRecurringItems = recurringItems.filter(item =>
        isBillDueInPeriod(item, startDate, endDate)
      );
      const totalRecurring = activeRecurringItems.reduce((sum, item) => sum + item.amount, 0);

      // Filter pending recurring items (due today or later in this cycle)
      const today = startOfDay(new Date());
      const pendingRecurringItems = activeRecurringItems.filter(item =>
        isBillPendingInPeriod(item, startDate, endDate, today)
      );
      const pendingRecurring = pendingRecurringItems.reduce((sum, item) => sum + item.amount, 0);

      // 4. Fetch Transactions
      const transactionsCollRef = collection(db, 'users', user.uid, 'transactions');
      const q = query(
        transactionsCollRef,
        where('date', '>=', startDate.toISOString()),
        where('date', '<=', endDate.toISOString())
      );
      
      const transactionsSnapshot = await getDocs(q);
      const transactions = transactionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Transaction[];

      // Filter expenses: exclude transactions that are auto-generated/linked instances of recurring bills
      const expensesInPeriod = transactions.filter(t => t.type === 'expense' && !t.isRecurringInstance);
      const totalSpent = expensesInPeriod.reduce((sum, t) => sum + t.amount, 0);

      // Filter ad-hoc income
      const incomeInPeriod = transactions.filter(t => t.type === 'income');
      const totalAdHocIncome = incomeInPeriod.reduce((sum, t) => sum + t.amount, 0);

      // 4.5 Fetch Planned Expenses for this Period
      let plannedInPeriod: PlannedExpense[] = [];
      let totalPlanned = 0;
      try {
        const plannedCollRef = collection(db, 'users', user.uid, 'planned_expenses');
        const plannedSnapshot = await getDocs(plannedCollRef);
        const allPlanned = plannedSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as PlannedExpense[];

        plannedInPeriod = allPlanned.filter(item => {
          if (item.isCompleted) return false;
          if (!item.targetDate) return false;
          const target = parseISO(item.targetDate);
          return !isBefore(target, startOfDay(startDate)) && !isAfter(target, endOfDay(endDate));
        });
        totalPlanned = plannedInPeriod.reduce((sum, item) => sum + item.amount, 0);
      } catch (err) {
        console.warn('Error fetching planned expenses:', err);
      }

      // 5. Calculate Left to Spend
      // Mode 'reserved': deduct ALL bills due in cycle upfront (Safety view)
      // Mode 'pending': deduct only upcoming bills still to clear (Cashflow view)
      const billDeduction = billMode === 'reserved' ? totalRecurring : pendingRecurring;
      const leftToSpend = (income + totalAdHocIncome) - billDeduction - totalSpent - totalPlanned;

      // Calculate Progress
      let progress = 0;
      const disposableIncome = income - billDeduction - totalPlanned;
      if (disposableIncome > 0) {
        progress = totalSpent / disposableIncome;
      } else if (totalSpent > 0) {
        progress = 1;
      }

      // Calculate Days Remaining and Safe Daily Allowance
      let daysRemaining = 0;
      if (cycleOffset === 0) {
        daysRemaining = Math.max(1, differenceInCalendarDays(endDate, today) + 1);
      } else if (cycleOffset > 0) {
        daysRemaining = Math.max(1, differenceInCalendarDays(endDate, startDate) + 1);
      } else {
        daysRemaining = 0;
      }
      const safeDailyAllowance = daysRemaining > 0 ? Math.max(0, leftToSpend / daysRemaining) : 0;

      setData({
        leftToSpend,
        baseIncome: income,
        totalRecurring,
        pendingRecurring,
        totalSpent,
        totalPlanned,
        currencyCode: preferences?.currencyCode || 'USD',
        currencySymbol: preferences?.currencySymbol || '$',
        currentCycle,
        transactions,
        plannedExpenses: plannedInPeriod,
        userProfile,
        loading: false,
        error: null,
        progress: Math.min(Math.max(progress, 0), 1),
        daysRemaining,
        safeDailyAllowance,
        refetch: fetchData,
      });

    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setData(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, [user, cycleOffset, billMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    ...data,
    cycleOffset,
    billMode,
    setBillMode,
    setCycleOffset,
    navigateCycle,
    resetToCurrentCycle,
  };
};
