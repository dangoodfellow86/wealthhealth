import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, Unsubscribe, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Transaction } from '../types';

export const addTransaction = async (uid: string, transaction: Omit<Transaction, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'users', uid, 'transactions'), transaction);
    return docRef.id;
  } catch (error) {
    console.error('Error adding transaction:', error);
    throw error;
  }
};

export const deleteTransaction = async (uid: string, transactionId: string): Promise<void> => {
  try {
    const transactionRef = doc(db, 'users', uid, 'transactions', transactionId);
    await deleteDoc(transactionRef);
  } catch (error) {
    console.error('Error deleting transaction:', error);
    throw error;
  }
};

export const updateTransaction = async (uid: string, transactionId: string, transaction: Partial<Transaction>): Promise<void> => {
  try {
    const transactionRef = doc(db, 'users', uid, 'transactions', transactionId);
    await updateDoc(transactionRef, transaction);
  } catch (error) {
    console.error('Error updating transaction:', error);
    throw error;
  }
};

export const subscribeToTransactions = (uid: string, callback: (data: Transaction[]) => void): Unsubscribe => {
  const transactionsRef = collection(db, 'users', uid, 'transactions');
  const q = query(transactionsRef, orderBy('date', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const transactions: Transaction[] = [];
    snapshot.forEach((doc) => {
      transactions.push({ id: doc.id, ...doc.data() } as Transaction);
    });
    callback(transactions);
  }, (error) => {
    console.error("Error fetching transactions: ", error);
  });
};
