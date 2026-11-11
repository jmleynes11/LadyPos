import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../shared/hooks/AuthContext.jsx";
import { Brand, Icon, Notice } from "../../../shared/components/BookstoreUI.jsx";
import { bookstoreLandingPath } from "../../bookstore/navigation.js";

export default function LoginPage() {
  const { login, isLoading, error } = useAuth();
  const [identifier, setIdentifier] = useState(""), [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false), [showPassword, setShowPassword] = useState(false), [failure, setFailure] = useState("");
  const navigate = useNavigate();
  const submit = async event => {
    event.preventDefault(); setFailure("");
    try { const success = await login({ identifier, password, remember }); setShowPassword(false); if (success) navigate(bookstoreLandingPath(success)); }
    catch (err) { setFailure(err.message || "Sign in unavailable"); }
  };
  return <main className="auth-shell"><section className="auth-brand-panel"><Brand /><div className="eyebrow" style={{ color: "var(--color-accent)" }}>The official university bookstore</div><h1>Everything you need.<br /><span>Ready for your<br />next chapter.</span></h1><p>Point-of-Sale and Inventory Management System for the University Bookstore.</p><div className="auth-brand-footer"><Icon name="shield" />University of Perpetual Help System DALTA</div></section><section className="auth-form-panel"><div className="auth-form"><div className="eyebrow">UPHSD BOOKSTORE POS</div><h2>Welcome back</h2><p>Sign in to your assigned bookstore workspace.</p>{(failure || error) && <Notice error>{failure || error}</Notice>}<form onSubmit={submit}><label htmlFor="identifier">Username or email<input id="identifier" className="input" autoComplete="username" value={identifier} onChange={event => setIdentifier(event.target.value)} placeholder="Enter your username" required /></label><label htmlFor="password">Password<div className="password-field"><input id="password" className="input" autoComplete="current-password" type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" required /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)}>{showPassword ? "Hide" : "Show"}</button></div></label><label className="checkbox-row"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />Remember me on this device</label><button className="primary-action" disabled={isLoading}>{isLoading ? "Signing in…" : "Sign in"}<Icon name="arrow" size={17} /></button></form><p className="helper-text">Account access and password resets are managed by your Administrator.</p><div className="auth-divider"><span>Shopping at the bookstore</span></div><Link className="auth-guest" to="/kiosk"><Icon name="bag" size={25} /><div>Continue as a guest<small>Browse and order. No account required.</small></div><Icon name="arrow" size={17} /></Link></div></section></main>;
}
