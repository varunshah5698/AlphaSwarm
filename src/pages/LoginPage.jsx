import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';
import { AuthShell, Field, EMAIL_RE } from '../components/AuthShell';

export default function LoginPage() {
  const { login, authLoading, isAuthenticated } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (params.get('registered')) toast.success('Account created — sign in to continue.');
    if (params.get('session') === 'expired') toast.error('Session expired — please sign in again.');
  }, [params]);

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated]);

  const validate = () => {
    const e = {};
    if (!EMAIL_RE.test(form.email.trim())) e.email = 'Enter a valid email address.';
    if (!form.password) e.password = 'Enter your password.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in with your email and password to open the terminal."
      footer={<p style={{ textAlign: 'center', fontSize: '.83rem', marginTop: '1.1rem' }}>No account? <Link to="/register" style={{ fontWeight: 800, textDecoration: 'underline' }}>Create one</Link> · <Link to="/" style={{ textDecoration: 'underline' }}>Home</Link></p>}
    >
      <form onSubmit={submit} noValidate className="pv-card" style={{ display: 'flex', flexDirection: 'column', gap: '.95rem' }}>
        <Field label="Email" error={errors.email}>
          <input className="pv-input" autoComplete="email" inputMode="email" placeholder="you@university.edu" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-invalid={!!errors.email} />
        </Field>
        <Field label="Password" error={errors.password}>
          <div style={{ position: 'relative' }}>
            <input className="pv-input" autoComplete="current-password" type={showPw ? 'text' : 'password'} placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} aria-invalid={!!errors.password} style={{ paddingRight: '3.2rem' }} />
            <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 8, top: 8, fontSize: '.72rem', background: 'none', border: 'none', fontWeight: 700 }}>{showPw ? 'HIDE' : 'SHOW'}</button>
          </div>
        </Field>
        <button className="pv-btn pv-btn-primary" type="submit" disabled={authLoading} style={{ width: '100%', opacity: authLoading ? .7 : 1 }}>
          {authLoading ? '◌ Signing in…' : 'Sign in →'}
        </button>
      </form>
    </AuthShell>
  );
}
