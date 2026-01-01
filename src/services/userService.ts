import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { UserProfile } from '../types';

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const userRef = doc(db, 'users', uid);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
};

export const createUserProfile = async (uid: string, profileData: Omit<UserProfile, 'createdAt'>) => {
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
      ...profileData,
      createdAt: serverTimestamp(),
    });
    console.log('User profile created successfully');
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw error;
  }
};

export const updateUserProfile = async (uid: string, data: Partial<UserProfile>) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, data);
    console.log('User profile updated successfully');
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

export const setIncomeOverride = async (uid: string, startDate: string, amount: number) => {
  try {
    const overrideRef = doc(db, 'users', uid, 'cycle_overrides', startDate);
    await setDoc(overrideRef, {
      startDate,
      amount,
      updatedAt: serverTimestamp(),
    });
    console.log('Cycle income override set successfully');
  } catch (error) {
    console.error('Error setting cycle income override:', error);
    throw error;
  }
};

