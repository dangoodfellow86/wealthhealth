import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    orderBy,
    query,
    updateDoc
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { RecurringItem } from '../types';

export const getRecurringBills = async (uid: string): Promise<RecurringItem[]> => {
  try {
    const recurringCollRef = collection(db, 'users', uid, 'recurring_items');
    // Order by title or dayOfMonth? Let's order by title for now.
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

export const addRecurringBill = async (uid: string, bill: Omit<RecurringItem, 'id'>): Promise<RecurringItem> => {
  try {
    const recurringCollRef = collection(db, 'users', uid, 'recurring_items');
    const docRef = await addDoc(recurringCollRef, bill);
    return {
      id: docRef.id,
      ...bill,
    };
  } catch (error) {
    console.error('Error adding recurring bill:', error);
    throw error;
  }
};

export const updateRecurringBill = async (uid: string, billId: string, updates: Partial<RecurringItem>): Promise<void> => {
  try {
    const billRef = doc(db, 'users', uid, 'recurring_items', billId);
    await updateDoc(billRef, updates);
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
