// src/features/profile/hooks/useAdminUsers.js
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../hooks/AuthContext.jsx";
import {
  getUsers,
  createUser,
  adminUpdateUser,
  adminDeleteUser,
} from "../../features/auth/api/authApi.js";
import { parseError } from "../../features/auth/utils/errorhandler.js";
import { normalizePHPhone, isValidPHPhone } from "./phoneUtils.js";
import toast from "react-hot-toast";

const PAGE_SIZE = 10;

const validateUserForm = (data, isEdit) => {
  const errors = {};
  if (!data.reason?.trim()) errors.reason = "Reason is required";
  if (!data.role) errors.general = "Select an approved role";
  if (!data.identifier?.trim() || data.identifier.trim().length < 3)
    errors.identifier = "Identifier must be at least 3 characters";
  if (!isEdit && (!data.password || data.password.length < 6))
    errors.password = "Password must be at least 6 characters";
  if (!data.phone?.trim()) {
    errors.phone = "Phone is required";
  } else if (!isValidPHPhone(normalizePHPhone(data.phone))) {
    errors.phone = "Enter a valid PH number (09XXXXXXXXX or +639XXXXXXXXX)";
  }
  return errors;
};

export function useAdminUsers() {
  const { user, jwt } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [formErrors, setFormErrors] = useState({});

  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  const fetchUsers = useCallback(
    async (searchTerm, pageNum) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const data = await getUsers(jwt, {
          search: searchTerm,
          page: pageNum,
          limit: PAGE_SIZE,
        });
        if (Array.isArray(data)) {
          setUsers(data);
          setTotalPages(1);
        } else {
          setUsers(data.users ?? []);
          setTotalPages(data.totalPages ?? 1);
        }
      } catch (err) {
        if (err.code !== "ERR_CANCELED") toast.error(parseError(err));
      } finally {
        setLoading(false);
      }
    },
    [jwt],
  );

  useEffect(() => {
    if (user?.role !== "admin") return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchUsers(search, page), 300);
    return () => {
      clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [search, page, fetchUsers, user?.role]);

  const handleSearchChange = useCallback((value) => {
    setSearch(value);
    setPage(1);
  }, []);

  const saveUser = useCallback(
    async (formData) => {
      const isEdit = !!formData._id;
      const errors = validateUserForm(formData, isEdit);
      if (Object.keys(errors).length) {
        setFormErrors(errors);
        return false;
      }
      setFormErrors({});

      const payload = {
        reason: formData.reason,
        operationId: formData.operationId,
        ...(isEdit ? { expectedVersion: formData.securityVersion } : {}),
        ...(formData.reviewId ? { reviewId: formData.reviewId } : {}),
        identifier: formData.identifier.toLowerCase().trim(),
        role: formData.role,
        confirmed: formData.confirmed,
        name: formData.name?.trim() || "",
        phone: normalizePHPhone(formData.phone),
        address: formData.address?.trim() || "",
      };
      if (formData.password) payload.password = formData.password;
      if (!isEdit) delete payload.confirmed;

      try {
        if (isEdit) {
          const updated = await adminUpdateUser(formData._id, payload, jwt);
          setUsers((prev) =>
            prev.map((u) => (u._id === updated._id ? updated : u)),
          );
          toast.success("User updated");
        } else {
          const created = await createUser(payload, jwt);
          setUsers((prev) => [created, ...prev]);
          toast.success("User created");
        }
        return true;
      } catch (err) {
        toast.error(parseError(err));
        return false;
      }
    },
    [jwt],
  );

  const deleteUserById = useCallback(
    async (id) => {
      if (id === user._id) {
        toast.error("Cannot delete your own account");
        return false;
      }
      try {
        const reason = window.prompt("Reason for deleting this account");
        if (!reason?.trim()) return false;
        await adminDeleteUser(id, jwt, { reason, operationId: crypto.randomUUID() });
        setUsers((prev) => prev.filter((u) => u._id !== id));
        toast.success("User deleted");
        return true;
      } catch (err) {
        toast.error(parseError(err));
        return false;
      }
    },
    [jwt, user._id],
  );

  return {
    users,
    loading,
    search,
    page,
    totalPages,
    formErrors,
    setFormErrors,
    handleSearchChange,
    setPage,
    saveUser,
    deleteUserById,
  };
}
