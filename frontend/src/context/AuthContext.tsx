import React, { createContext, useContext, useState, useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import apiClient from "../api/client";

interface User {
  id: string;
  nickname: string;
  provider: string;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  signIn: (token: string, userData?: User) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const bootstrapAsync = async () => {
      let userToken;
      try {
        userToken = await SecureStore.getItemAsync("userToken");
        if (userToken) {
          // Verify token if needed or load user profile
          setToken(userToken);
          setApiClientAuth(userToken);
        }
      } catch (e) {
        console.error("Restoring token failed", e);
      }
      setIsLoading(false);
    };

    bootstrapAsync();
  }, []);

  const setApiClientAuth = (authToken: string | null) => {
    if (authToken) {
      apiClient.defaults.headers.common["Authorization"] = `Bearer ${authToken}`;
    } else {
      delete apiClient.defaults.headers.common["Authorization"];
    }
  };

  const signIn = async (newToken: string, userData?: User) => {
    try {
      await SecureStore.setItemAsync("userToken", newToken);
      setToken(newToken);
      setApiClientAuth(newToken);
      if (userData) setUser(userData);
    } catch (e) {
      console.error("Failed to save token", e);
    }
  };

  const signOut = async () => {
    try {
      await SecureStore.deleteItemAsync("userToken");
      setToken(null);
      setUser(null);
      setApiClientAuth(null);
    } catch (e) {
      console.error("Failed to remove token", e);
    }
  };

  return (
    <AuthContext.Provider value={{ token, user, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
