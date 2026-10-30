import {
  addDays,
  addMonths,
  addWeeks,
  endOfDay,
  isAfter,
  isBefore,
  isValid,
  isWeekend,
  lastDayOfMonth,
  parseISO,
  setDate,
  startOfDay,
  subDays,
  subMonths
} from 'date-fns';
import { PayFrequency, RecurringItem, UserProfile } from '../types';

/**
 * Helper to find the last working day of a given month.
 * @param date Any date within the target month
 * @returns The Date object representing the last working day of that month
 */
const getLastWorkingDayOfMonth = (date: Date): Date => {
  let lastDay = lastDayOfMonth(date);
  while (isWeekend(lastDay)) {
    lastDay = subDays(lastDay, 1);
  }
  return lastDay;
};

/**
 * Calculates the start and end dates of the current pay cycle based on the user's financial settings.
 *
 * Logic based on Section 4B of Project Context:
 * - Weekly/Bi-Weekly/4-Weekly: Iterative addition from lastPayDate.
 * - Monthly (Specific Date): Compare today with payDayOfMonth.
 * - Monthly (Last Working Day): Calculate last weekday of month.
 *
 * @param financialSettings The user's financial configuration (pay frequency, anchor dates).
 * @returns Object containing startDate and endDate of the current cycle.
 */
export const getCurrentPayPeriod = (
  financialSettings: UserProfile['financialSettings'],
  referenceDate: Date = new Date()
): { startDate: Date; endDate: Date } => {
  const today = startOfDay(referenceDate);
  const { payFrequency, lastPayDate, payDayOfMonth } = financialSettings;

  // Default fallback
  const fallback = {
    startDate: startOfDay(referenceDate),
    endDate: endOfDay(referenceDate),
  };

  try {
    // SCENARIO A: Weekly / Bi-Weekly / 4-Weekly
    if (
      payFrequency === PayFrequency.WEEKLY ||
      payFrequency === PayFrequency.BI_WEEKLY ||
      payFrequency === PayFrequency.FOUR_WEEKLY
    ) {
      if (!lastPayDate) return fallback;

      const anchorDate = parseISO(lastPayDate);
      if (!isValid(anchorDate)) return fallback;

      let weeksToAdd = 1;
      if (payFrequency === PayFrequency.BI_WEEKLY) weeksToAdd = 2;
      if (payFrequency === PayFrequency.FOUR_WEEKLY) weeksToAdd = 4;

      // Iterate forward from anchor until we find the cycle containing 'today'
      // Cycle is defined as [Start, NextStart) or [Start, End] where End = NextStart - 1 day
      // We'll assume the cycle starts on the pay date.
      
      let currentCycleStart = startOfDay(anchorDate);
      
      // Safety break to prevent infinite loops if dates are wild
      let iterations = 0;
      const MAX_ITERATIONS = 10000; // Approx 190 years of weeks

      // If anchor is in the future, we might need to go backwards, but requirements say "iterate forward".
      // Assuming anchor is in the past. If anchor is in future, this logic needs adjustment or we assume it's the start of a future cycle.
      // Let's handle the case where anchor is in the past.
      
      if (isAfter(currentCycleStart, today)) {
         // If anchor is in the future, we iterate backwards? 
         // Or just return the anchor as the start?
         // Let's assume anchor is the start of *a* cycle.
         // If today is before anchor, we need to go back.
         while (isAfter(currentCycleStart, today) && iterations < MAX_ITERATIONS) {
             currentCycleStart = addWeeks(currentCycleStart, -weeksToAdd);
             iterations++;
         }
      } else {
        // Anchor is in past or today. Iterate forward until next cycle start is > today.
        while (iterations < MAX_ITERATIONS) {
            const nextCycleStart = addWeeks(currentCycleStart, weeksToAdd);
            if (isAfter(nextCycleStart, today)) {
                // Found it. currentCycleStart <= today < nextCycleStart
                break;
            }
            currentCycleStart = nextCycleStart;
            iterations++;
        }
      }

      const nextStart = addWeeks(currentCycleStart, weeksToAdd);
      return {
        startDate: currentCycleStart,
        endDate: subDays(nextStart, 1), // End is the day before the next pay date
      };
    }

    // SCENARIO B: Monthly Specific Date
    if (payFrequency === PayFrequency.MONTHLY_SPECIFIC_DATE) {
      if (!payDayOfMonth) return fallback;

      // Construct the pay date for the current month
      // Note: payDayOfMonth might be 31, but current month only has 30. setDate handles this (rolls over), 
      // but usually for "Pay Day" logic we want the last valid day if it exceeds.
      // However, let's stick to simple setDate for now or clamp it.
      // Better to clamp: Math.min(payDayOfMonth, daysInMonth)
      
      // Actually, let's determine the "Pay Date" for the current month and previous month.
      // Logic: If today < PayDate(CurrentMonth), then cycle started PayDate(PrevMonth).
      // Else cycle started PayDate(CurrentMonth).
      
      const getPayDateForMonth = (baseDate: Date, day: number) => {
          const targetMonth = startOfDay(baseDate);
          const daysInMonth = lastDayOfMonth(targetMonth).getDate();
          const actualDay = Math.min(day, daysInMonth);
          return setDate(targetMonth, actualDay);
      };

      const currentMonthPayDate = getPayDateForMonth(today, payDayOfMonth);
      
      let start: Date;
      let nextStart: Date;

      if (isBefore(today, currentMonthPayDate)) {
          // We are in the cycle that started last month
          start = getPayDateForMonth(subMonths(today, 1), payDayOfMonth);
          nextStart = currentMonthPayDate;
      } else {
          // We are in the cycle that started this month
          start = currentMonthPayDate;
          nextStart = getPayDateForMonth(addMonths(today, 1), payDayOfMonth);
      }

      return {
          startDate: start,
          endDate: subDays(nextStart, 1)
      };
    }

    // SCENARIO C: Monthly Last Working Day
    if (payFrequency === PayFrequency.MONTHLY_LAST_WORKING_DAY) {
        const currentMonthLastWorking = getLastWorkingDayOfMonth(today);
        
        let start: Date;
        let nextStart: Date;

        if (isBefore(today, currentMonthLastWorking)) {
            // Current cycle started on last working day of previous month
            start = getLastWorkingDayOfMonth(subMonths(today, 1));
            nextStart = currentMonthLastWorking;
        } else {
            // Today is on or after the last working day (e.g. it IS the last working day, or it's a weekend after it?)
            // If today is the last working day, usually that's the start of the *new* money coming in? 
            // Or is it the end of the earning period?
            // "Pay Period" usually refers to the period for which you have money.
            // If I get paid on Jan 31st, that money lasts me until Feb 28th.
            // So if today is Jan 31st, I just got paid. My "Current Pay Period" (money in hand) starts today.
            
            // If today is Jan 10th, I am spending Dec 31st's money.
            // So if today < Jan 31st, Start = Dec 31st.
            // If today == Jan 31st, Start = Jan 31st.
            
            start = currentMonthLastWorking;
            nextStart = getLastWorkingDayOfMonth(addMonths(today, 1));
        }

        return {
            startDate: start,
            endDate: subDays(nextStart, 1)
        };
    }

    return fallback;

  } catch (error) {
    console.error("Error calculating pay period:", error);
    return fallback;
  }
};

/**
 * Calculates a pay period with an offset from today.
 * offset = 0: current pay period
 * offset > 0: N periods into the future
 * offset < 0: N periods into the past
 */
export const getPayPeriodWithOffset = (
  financialSettings: UserProfile['financialSettings'],
  offset: number = 0,
  referenceDate: Date = new Date()
): { startDate: Date; endDate: Date } => {
  let period = getCurrentPayPeriod(financialSettings, referenceDate);
  if (offset === 0) return period;

  if (offset > 0) {
    for (let i = 0; i < offset; i++) {
      const nextDay = addDays(period.endDate, 1);
      period = getCurrentPayPeriod(financialSettings, nextDay);
    }
  } else {
    for (let i = 0; i < Math.abs(offset); i++) {
      const prevDay = subDays(period.startDate, 1);
      period = getCurrentPayPeriod(financialSettings, prevDay);
    }
  }

  return period;
};

/**
 * Determines whether a recurring bill is due within a given pay period.
 */
export const isBillDueInPeriod = (
  bill: RecurringItem,
  cycleStart: Date,
  cycleEnd: Date
): boolean => {
  if (!bill.isActive) return false;
  const frequency = bill.frequency || 'MONTHLY';

  const start = startOfDay(cycleStart);
  const end = endOfDay(cycleEnd);

  if (frequency === 'WEEKLY' || frequency === 'BI_WEEKLY') {
    return true;
  }

  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  if (frequency === 'ANNUAL') {
    const targetMonth = (bill.dueMonth || 1) - 1; // 0-indexed
    const targetDay = bill.dayOfMonth || 1;

    for (let yr = startYear; yr <= endYear; yr++) {
      const daysInTargetMonth = lastDayOfMonth(new Date(yr, targetMonth, 1)).getDate();
      const actualDay = Math.min(targetDay, daysInTargetMonth);
      const billDate = startOfDay(new Date(yr, targetMonth, actualDay));
      if (!isBefore(billDate, start) && !isAfter(billDate, end)) {
        return true;
      }
    }
    return false;
  }

  if (frequency === 'QUARTERLY') {
    const baseMonth = (bill.dueMonth || 1) - 1;
    const targetDay = bill.dayOfMonth || 1;
    const quarterlyMonths = [baseMonth % 3, (baseMonth % 3) + 3, (baseMonth % 3) + 6, (baseMonth % 3) + 9];

    for (let yr = startYear; yr <= endYear; yr++) {
      for (const m of quarterlyMonths) {
        const daysInTargetMonth = lastDayOfMonth(new Date(yr, m, 1)).getDate();
        const actualDay = Math.min(targetDay, daysInTargetMonth);
        const billDate = startOfDay(new Date(yr, m, actualDay));
        if (!isBefore(billDate, start) && !isAfter(billDate, end)) {
          return true;
        }
      }
    }
    return false;
  }

  // Default: MONTHLY
  if (!bill.dayOfMonth) {
    return true; // No specific date provided; applies to every monthly cycle
  }

  let cursor = startOfDay(start);
  while (!isAfter(cursor, end)) {
    const daysInMonth = lastDayOfMonth(cursor).getDate();
    const actualDay = Math.min(bill.dayOfMonth, daysInMonth);
    const billDate = startOfDay(setDate(cursor, actualDay));
    if (!isBefore(billDate, start) && !isAfter(billDate, end)) {
      return true;
    }
    cursor = addMonths(cursor, 1);
  }

  return false;
};
