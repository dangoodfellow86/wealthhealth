import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebaseConfig';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  hasProfile: boolean;
  checkProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  isLoading: true,
  hasProfile: false,
  checkProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);

  const checkProfile = async (currentUser: User | null = user) => {
    if (!currentUser) {
      setHasProfile(false);
      setUserProfile(null);
      return;
    }
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        setHasProfile(true);
        setUserProfile(userDoc.data() as UserProfile);
      } else {
        setHasProfile(false);
        setUserProfile(null);
      }
    } catch (error) {
      console.error('Error checking profile:', error);
      setHasProfile(false);
      setUserProfile(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        await checkProfile(user);
      } else {
        setHasProfile(false);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, userProfile, isLoading, hasProfile, checkProfile: () => checkProfile(user) }}>
      {children}
    </AuthContext.Provider>
  );
};
