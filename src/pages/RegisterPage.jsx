import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';
import { AuthShell, Field, EMAIL_RE, USER_RE, passwordStrength } from '../components/AuthShell';

export default function RegisterPage() {
  const { register, authLoading } = useStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!USER_RE.test(form.username.trim())) e.username = '3-24 chars: letters, numbers, _ . -';
    if (!EMAIL_RE.test(form.email.trim())) e.email = 'Enter a valid email address.';
    if (form.password.length < 8) e.password = 'At least 8 characters.';
    else if (!/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) e.password = 'Include a letter and a number.';
    if (form.confirm !== form.password) e.confirm = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    try {
      await register(form.username, form.email, form.password);
      toast.success('Account created — please sign in.');
      navigate('/login?registered=1', { replace: true });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const strength = passwordStrength(form.password);
  const rules = [
    [form.password.length >= 8, 'At least 8 characters'],
    [/[A-Za-z]/.test(form.password) && /[0-9]/.test(form.password), 'A letter and a number'],
    [form.confirm !== '' && form.confirm === form.password, 'Passwords match'],
  ];

  return (
    <AuthShell
      title="Create your account"
      subtitle="Username, email and password — then sign in to open the terminal."
      footer={<p style={{ textAlign: 'center', fontSize: '.83rem', marginTop: '1.1rem' }}>Already have an account? <Link to="/login" style={{ fontWeight: 800, textDecoration: 'underline' }}>Sign in</Link></p>}
    >
      <form onSubmit={submit} noValidate className="pv-card" style={{ display: 'flex', flexDirection: 'column', gap: '.95rem' }}>
        <Field label="Username" error={errors.username} hint="Public handle, e.g. varun_quant">
          <input className="pv-input" autoComplete="username" placeholder="varun_quant" value={form.username} onChange={(e) => set('username', e.target.value)} aria-invalid={!!errors.username} />
        </Field>
        <Field label="Email" error={errors.email}>
          <input className="pv-input" autoComplete="email" inputMode="email" placeholder="you@university.edu" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-invalid={!!errors.email} />
        </Field>
        <Field label="Password" error={errors.password} hint="Min 8 chars with a letter and a number.">
          <div style={{ position: 'relative' }}>
            <input className="pv-input" autoComplete="new-password" type={showPw ? 'text' : 'password'} placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} aria-invalid={!!errors.password} style={{ paddingRight: '3.2rem' }} />
            <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 8, top: 8, fontSize: '.72rem', background: 'none', border: 'none', fontWeight: 700 }}>{showPw ? 'HIDE' : 'SHOW'}</button>
          </div>
          {!!form.password && (
            <div style={{ display: 'flex', gap: 4, marginTop: '.4rem' }} aria-hidden>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{ height: 4, flex: 1, borderRadius: 4, background: i <= strength ? (strength >= 4 ? 'var(--success)' : strength >= 3 ? 'var(--warning)' : 'var(--danger)') : 'var(--border)' }} />
              ))}
            </div>
          )}
          <ul style={{ listStyle: 'none', marginTop: '.5rem', display: 'flex', flexDirection: 'column', gap: '.2rem' }} aria-live="polite">
            {rules.map(([ok, label]) => (
              <li key={label} style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.75rem', fontWeight: 500, color: ok ? 'var(--success)' : 'var(--text-muted)' }}>
                <span style={{ width: 15, height: 15, borderRadius: '50%', background: ok ? 'var(--success)' : 'transparent', border: `1.5px solid ${ok ? 'var(--success)' : 'var(--border)'}`, color: '#fff', fontSize: '.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ok ? '✓' : ''}</span>
                {label}
              </li>
            ))}
          </ul>
        </Field>
        <Field label="Confirm password" error={errors.confirm}>
          <input className="pv-input" autoComplete="new-password" type={showPw ? 'text' : 'password'} placeholder="Repeat password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} aria-invalid={!!errors.confirm} />
        </Field>
        <button className="pv-btn pv-btn-primary" type="submit" disabled={authLoading} style={{ width: '100%', opacity: authLoading ? .7 : 1 }}>
          {authLoading ? '◌ Creating account…' : 'Create account →'}
        </button>
        <p style={{ fontSize: '.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>By registering you agree this is a research tool, not investment advice.</p>
      </form>
    </AuthShell>
  );
}
