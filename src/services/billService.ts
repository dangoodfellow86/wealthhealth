import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { RecurringItem } from '../types';

export const getRecurringBills = async (uid: string): Promise<RecurringItem[]> => {
  try {
    const recurringCollRef = collection(db, 'users', uid, 'recurring_items');
    const q = query(recurringCollRef, orderBy('title'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as RecurringItem[];
  } catch (error) {
    console.error('Error fetching recurring bills:', error);
    throw error;
  }
};

export const addRecurringBill = async (
  uid: string,
  bill: Omit<RecurringItem, 'id'>
): Promise<RecurringItem> => {
  try {
    const recurringCollRef = collection(db, 'users', uid, 'recurring_items');
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(bill)) {
      if (value !== undefined) {
        sanitized[key] = value;
      }
    }
    const docRef = await addDoc(recurringCollRef, sanitized);
    return {
      id: docRef.id,
      ...bill,
    };
  } catch (error) {
    console.error('Error adding recurring bill:', error);
    throw error;
  }
};

export const updateRecurringBill = async (
  uid: string,
  billId: string,
  updates: Record<string, any>
): Promise<void> => {
  try {
    const billRef = doc(db, 'users', uid, 'recurring_items', billId);
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        sanitized[key] = value;
      }
    }
    await updateDoc(billRef, sanitized);
  } catch (error) {
    console.error('Error updating recurring bill:', error);
    throw error;
  }
};

export const deleteRecurringBill = async (uid: string, billId: string): Promise<void> => {
  try {
    const billRef = doc(db, 'users', uid, 'recurring_items', billId);
    await deleteDoc(billRef);
  } catch (error) {
    console.error('Error deleting recurring bill:', error);
    throw error;
  }
};

export { deleteField };
