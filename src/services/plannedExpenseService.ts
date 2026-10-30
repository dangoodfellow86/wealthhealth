import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { PlannedExpense } from '../types';
import { addTransaction } from './transactionService';

export const getPlannedExpenses = async (uid: string): Promise<PlannedExpense[]> => {
  try {
    const plannedCollRef = collection(db, 'users', uid, 'planned_expenses');
    const q = query(plannedCollRef, orderBy('targetDate', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as PlannedExpense[];
  } catch (error) {
    console.error('Error fetching planned expenses:', error);
    return [];
  }
};

export const addPlannedExpense = async (
  uid: string,
  item: Omit<PlannedExpense, 'id'>
): Promise<PlannedExpense> => {
  try {
    const plannedCollRef = collection(db, 'users', uid, 'planned_expenses');
    const docRef = await addDoc(plannedCollRef, {
      ...item,
      isCompleted: false,
    });
    return {
      id: docRef.id,
      ...item,
      isCompleted: false,
    };
  } catch (error) {
    console.error('Error adding planned expense:', error);
    throw error;
  }
};

export const updatePlannedExpense = async (
  uid: string,
  id: string,
  updates: Partial<PlannedExpense>
): Promise<void> => {
  try {
    const docRef = doc(db, 'users', uid, 'planned_expenses', id);
    await updateDoc(docRef, updates);
  } catch (error) {
    console.error('Error updating planned expense:', error);
    throw error;
  }
};

export const deletePlannedExpense = async (uid: string, id: string): Promise<void> => {
  try {
    const docRef = doc(db, 'users', uid, 'planned_expenses', id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting planned expense:', error);
    throw error;
  }
};

export const convertPlannedToTransaction = async (
  uid: string,
  planned: PlannedExpense
): Promise<void> => {
  try {
    // 1. Add actual transaction
    await addTransaction(uid, {
      amount: planned.amount,
      category: planned.category || 'Other',
      date: new Date().toISOString(),
      note: planned.note ? `${planned.title} (${planned.note})` : planned.title,
      type: 'expense',
      accountId: 'default',
      isRecurringInstance: false,
    });

    // 2. Mark planned expense as completed
    await updatePlannedExpense(uid, planned.id, { isCompleted: true });
  } catch (error) {
    console.error('Error converting planned expense to transaction:', error);
    throw error;
  }
};
