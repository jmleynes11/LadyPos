import { createContext, useContext } from "react";
export const BookstoreState = createContext(null);
export const useBookstore = () => useContext(BookstoreState);
