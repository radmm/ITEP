import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { auth } from './lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isLoggingIn: boolean;
  login: (useRedirect?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  authError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    // Ensure persistence is set to local
    setPersistence(auth, browserLocalPersistence).catch(err => console.error("Persistence Error:", err));

    // Handle redirect result if page was reloaded after redirect
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          setUser(result.user);
        }
      })
      .catch((error) => {
        console.error("Redirect Error:", error);
        setAuthError(error.message);
      })
      .finally(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          setUser(user);
          setLoading(false);
          if (user) {
            setIsLoggingIn(false);
          }
        });
        return unsubscribe;
      });
  }, []);

  const login = async (useRedirect = false) => {
    setAuthError(null);
    setIsLoggingIn(true);
    
    const timeoutId = setTimeout(() => {
      if (!user) {
        setIsLoggingIn(false);
        setAuthError("Login is taking longer than expected. If you are in an iframe, try opening in a new tab.");
      }
    }, 60000);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      if (useRedirect) {
        await signInWithRedirect(auth, provider);
      } else {
        await signInWithPopup(auth, provider);
      }
      clearTimeout(timeoutId);
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error("Auth Error:", error);
      
      let msg = error.message;
      if (error.code === 'auth/popup-blocked') {
        msg = "Login popup blocked. Try using 'Direct Redirect' or allow popups.";
      } else if (error.code === 'auth/unauthorized-domain') {
        msg = "Domain not authorized. Add " + window.location.hostname + " to Firebase Authorized Domains.";
      } else if (error.code === 'auth/internal-error' && !useRedirect) {
        // Try fallback to redirect automatically for internal errors which often happen in iframes
        console.log("Internal error detected, falling back to redirect...");
        await login(true);
        return;
      }
      
      setAuthError(msg || "Authentication failed.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isLoggingIn, login, logout, authError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
