import { Link } from "react-router-dom";
import { Brand, Notice } from "../../../shared/components/BookstoreUI.jsx";
export default function RegisterPage() {
  return <main className="auth-shell"><section className="auth-brand-panel"><Brand /><h1>Your university.<br /><span>Your bookstore.</span></h1><p>University of Perpetual Help System DALTA</p></section><section className="auth-form-panel"><div className="auth-form"><div className="eyebrow">Account access</div><h2>Managed by your university</h2><p>Existing student and staff accounts are provisioned and reviewed by an Administrator.</p><Notice>Public registration is unavailable. Guests can order without creating an account.</Notice><div className="form-stack"><Link className="primary-action" to="/login">Sign in</Link><Link className="secondary-action" to="/kiosk">Continue as a guest</Link></div></div></section></main>;
}
