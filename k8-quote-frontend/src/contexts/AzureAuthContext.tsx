import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import apiService from '../api/authApi';

interface User {
  id: string;
  email: string;
  username: string;
  roles: string[];
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AzureAuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAzureAuth = () => {
  const context = useContext(AzureAuthContext);
  if (!context) {
    throw new Error('useAzureAuth must be used within AzureAuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AzureAuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      // Decode JWT to get user info
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({
          id: payload.sub || payload.nameid,
          email: payload.email,
          username: payload.username || payload.unique_name,
          roles: Array.isArray(payload.groups) ? payload.groups : (payload.groups ? [payload.groups] : []),
        });
      } catch (error) {
        console.error('Invalid token:', error);
        localStorage.removeItem('jwt_token');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await apiService.login(username, password);
      console.log('Login response:', response);
      
      // The response only contains token info, user data is in the JWT
      const token = response.token;
      if (!token) {
        console.error('No token in response:', response);
        throw new Error('No token received from server');
      }
      
      // Decode JWT to get user info
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log('Decoded token payload:', payload);

        setUser({
          id: payload.sub || payload.nameid,
          email: payload.email,
          username: payload.username || payload.unique_name,
          roles: Array.isArray(payload.groups) ? payload.groups : (payload.groups ? [payload.groups] : []),
        });
      } catch (decodeError) {
        console.error('Failed to decode token:', decodeError);
        throw new Error('Invalid token received from server');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (userData: any) => {
    try {
      const response = await apiService.register(userData);
      console.log('Register response:', response);
      
      // Registration successful but no token - user should login separately
      // Just return success, don't set user or token
      return response;
    } catch (error: any) {
      console.error('Register error:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('jwt_token');
    setUser(null);
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.roles?.includes('ADMIN') || false;

  return (
    <AzureAuthContext.Provider value={{ 
      user, 
      login, 
      register, 
      logout, 
      isLoading, 
      isAuthenticated,
      isAdmin 
    }}>
      {children}
    </AzureAuthContext.Provider>
  );
};