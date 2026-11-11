import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

const authHeader = (jwt) => ({
  headers: {
    Authorization: `Bearer ${jwt}`,
  },
});

export const registerUser = async (userData, jwt) => {
  const response = await axios.post(
    `${API_URL}/users/register`,
    userData,
    authHeader(jwt),
  );
  return response.data;
};

export const loginUser = async (credentials) => {
  const response = await axios.post(`${API_URL}/users/login`, credentials);
  return response.data;
};

export const editUser = async (userData, jwt) => {
  const response = await axios.put(
    `${API_URL}/users/${userData._id}`,
    userData,
    authHeader(jwt),
  );
  return response.data;
};

export const deleteUser = async (userId, jwt) => {
  const response = await axios.delete(
    `${API_URL}/users/${userId}`,
    authHeader(jwt),
  );
  return response.data;
};

export const getUsers = async (jwt) => {
  const response = await axios.get(`${API_URL}/users`, authHeader(jwt));
  return response.data;
};

export const getProfile = (jwt) =>
  axios.get(`${API_URL}/users/profile`, authHeader(jwt)).then((r) => r.data);

export const updateProfile = (payload, jwt) =>
  axios
    .put(`${API_URL}/users/profile`, payload, authHeader(jwt))
    .then((r) => r.data);

export const updatePassword = (payload, jwt) =>
  axios
    .put(`${API_URL}/users/password`, payload, authHeader(jwt))
    .then((r) => r.data);

export const createUser = (payload, jwt) =>
  axios
    .post(`${API_URL}/users/register`, payload, authHeader(jwt))
    .then((r) => r.data);

export const adminUpdateUser = (id, payload, jwt) =>
  axios
    .put(`${API_URL}/users/${id}`, payload, authHeader(jwt))
    .then((r) => r.data);

export const adminDeleteUser = (id, jwt, command = {}) =>
  axios.delete(`${API_URL}/users/${id}`, { ...authHeader(jwt), data: command }).then((r) => r.data);

export const accountCommand = (id, action, payload, jwt) =>
  axios.post(`${API_URL}/users/${id}/${action}`, payload, authHeader(jwt)).then(r => r.data);
export const getAccountOperation = (operationId, jwt) =>
  axios.get(`${API_URL}/users/operations/${operationId}`, authHeader(jwt)).then(r => r.data);
