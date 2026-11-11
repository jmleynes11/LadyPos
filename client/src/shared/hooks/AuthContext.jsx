import { clearSessionPreservingPending } from "../../features/bookstore/pendingOperation.js";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { loginUser } from "../../features/auth/api/authApi";
import { logClientError } from "../utils/safeDiagnostics.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [jwt, setJwt] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearCredentials = () => {
    for (const storage of [localStorage, sessionStorage]) {
      storage.removeItem("user");
      storage.removeItem("jwt");
    }
  };

  const setUser = (userData) => {
    setUserState(userData);
    if (!userData) { clearCredentials(); setJwt(null); return; }
    // Profile edits retain the persistence selected by the successful login.
    const storage = sessionStorage.getItem("jwt") === jwt ? sessionStorage : localStorage;
    if (jwt) storage.setItem("user", JSON.stringify(userData));
  };

  useEffect(() => {
    // Read a complete pair from one location. Session takes precedence for
    // compatibility with older clients that left persistent credentials behind.
    for (const storage of [sessionStorage, localStorage]) {
      try {
        const storedUser = storage.getItem("user"), storedJwt = storage.getItem("jwt");
        const parsedUser = storedUser && JSON.parse(storedUser);
        if (!storedJwt || !parsedUser || typeof parsedUser !== "object" || !parsedUser._id) {
          storage.removeItem("user"); storage.removeItem("jwt"); continue;
        }
        const other = storage === sessionStorage ? localStorage : sessionStorage;
        other.removeItem("user"); other.removeItem("jwt");
        setJwt(storedJwt);
        setUserState(parsedUser);
        break;
      } catch (err) {
        logClientError("auth.storage_invalid", err);
        storage.removeItem("user"); storage.removeItem("jwt");
      }
    }

    setIsLoading(false);
  }, []);

  const login = async ({ identifier, password, remember }) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await loginUser({ identifier, password });

      const userData = {
        _id: data._id,
        identifier: data.identifier,
        role: data.role,
        confirmed: data.confirmed,
        name: data.name,
        phone: data.phone,
        address: data.address,
      };

      clearCredentials();
      if (remember) {
        localStorage.setItem("user", JSON.stringify(userData));
        localStorage.setItem("jwt", data.token);
      } else {
        sessionStorage.setItem("user", JSON.stringify(userData));
        sessionStorage.setItem("jwt", data.token);
      }
      setJwt(data.token);
      setUserState(userData);
      return data;
    } catch (err) {
      setJwt(null);
      setUserState(null);
      clearCredentials();
      setError(err.response?.data?.message || "Login failed");

      throw new Error(err.response?.data?.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const logout = useCallback(() => {
    localStorage.clear();
    clearSessionPreservingPending(sessionStorage);
    setJwt(null);
    setUserState(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        jwt,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
