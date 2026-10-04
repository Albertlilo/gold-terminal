import { useEffect, useState } from 'react';
import { onIdTokenChanged, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { API, accountClient, readAccount, accountFetch } from '../lib/accountClient';

function FreePreview() {
  const [data,setData] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/api/preview`, {signal:controller.signal}).then(response=>response.ok?response.json():null)
      .then(setData).catch(()=>{});
    return ()=>controller.abort();
  },[]);
  const prices = data?.prices || [];
  const low = Math.min(...prices.map(row=>row.close)), high = Math.max(...prices.map(row=>row.close));
  const points = prices.map((row,i)=>`${10+i*580/Math.max(1,prices.length-1)},${140-(row.close-low)/Math.max(1,high-low)*120}`).join(' ');
  return <section className="terminal-card"><h2>Trendline Insight · Free preview</h2>
    <p>Saved daily gold prices and a headline macro score. Technical analysis and macro analysis remain separate.</p>
    <p>Gold Score: <strong>{data?.score?.totalScore ?? 'Unavailable'}</strong> · {data?.score?.bias ?? 'Waiting for a recorded macro update'}</p>
    {data?.score?.observedAt && <p>Score recorded: {new Date(data.score.observedAt).toLocaleString()}</p>}
    {prices.length ? <><svg viewBox="0 0 600 160" role="img" aria-label="Saved daily gold closing prices"><polyline points={points} fill="none" stroke="#e9be46" strokeWidth="2" /></svg><p>Last saved daily close: {prices.at(-1).close.toFixed(2)} · {new Date(prices.at(-1).time*1000).toLocaleDateString()} · not a live quote.</p></> : <p>Saved price preview is currently unavailable.</p>}
  </section>;
}
export default function AccountGate({ children }) {
  const [user,setUser] = useState(null), [profile,setProfile] = useState(null), [ready,setReady] = useState(false);
  const [message,setMessage] = useState(() => {
    const billingState = new URLSearchParams(window.location.search).get('billing');
    return billingState === 'success' ? 'Checkout returned successfully. Pro turns on after Stripe confirms the payment; choose Refresh access in a moment.'
      : billingState === 'cancelled' ? 'Checkout was cancelled. Your free account is unchanged.' : '';
  }), [busy,setBusy] = useState(false);
  const [email,setEmail] = useState(''), [password,setPassword] = useState('');
  useEffect(() => {
    let alive=true, unsubscribe, generation=0;
    async function update(current) {
      const version=++generation;
      setUser(current); setProfile(null);
      if(current) {
        try { const access=await readAccount(); if(alive && version===generation)setProfile(access); }
        catch(error){if(alive && version===generation)setMessage(error.message);}
      }
    }
    accountClient().then(auth=>{
      if(!alive)return;
      setReady(true);
      unsubscribe=onIdTokenChanged(auth,current=>{if(alive)update(current);});
    }).catch(error=>{if(alive)setMessage(error.message);});
    const timer=setInterval(async()=>{
      const version=generation;
      try { const auth=await accountClient(); if(!auth.currentUser)return; const access=await readAccount();if(alive && version===generation)setProfile(access); }
      catch {if(alive && version===generation)setProfile(null);}
    },60000);
    return ()=>{alive=false;generation++;unsubscribe?.();clearInterval(timer);};
  },[]);
  useEffect(() => {
    const billingState = new URLSearchParams(window.location.search).get('billing');
    if (billingState) {
      const url = new URL(window.location.href);
      url.searchParams.delete('billing');
      window.history.replaceState({}, '', url);
    }
  },[]);
  async function billing(action) {
    setBusy(true); setMessage('');
    try {
      const response = await accountFetch(`${API}/api/billing/${action}`, { method: 'POST', signal: AbortSignal.timeout(30000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Billing could not be opened.');
      window.location.assign(data.url);
    } catch(error) { setMessage(error.message); setBusy(false); }
  }
  async function act(action) {
    setBusy(true);setMessage('');
    try {
      const auth=await accountClient();
      if(action==='google')await signInWithPopup(auth,new GoogleAuthProvider());
      if(action==='login')await signInWithEmailAndPassword(auth,email,password);
      if(action==='signup'){
        const result=await createUserWithEmailAndPassword(auth,email,password);
        await sendEmailVerification(result.user);setMessage('Check your email to verify your account, then choose Refresh access.');
      }
      if(action==='verify' && auth.currentUser){await sendEmailVerification(auth.currentUser);setMessage('Verification email sent.');}
      if(action==='reset'){await sendPasswordResetEmail(auth,email);setMessage('If an account is eligible, a reset email will arrive.');}
      if(action==='refresh'){
        await auth.currentUser?.reload();await auth.currentUser?.getIdToken(true);
        setProfile(await readAccount());setMessage('Access checked.');
      }
      if(action==='logout'){
        // Remove this device's account-linked alerts before leaving a shared device.
        let cleanupFailed=false;
        try {
          if('serviceWorker' in navigator){const reg=await navigator.serviceWorker.getRegistration('/');const sub=await reg?.pushManager.getSubscription();if(sub && !await sub.unsubscribe())cleanupFailed=true;}
          const token=localStorage.getItem('gold-terminal-push-device');
          if(token){
            const response=await accountFetch(`${API}/api/push/subscription`,{method:'DELETE',headers:{'X-Device-Token':token},signal:AbortSignal.timeout(15000)});
            if(!response.ok)cleanupFailed=true;
          }
        }catch{cleanupFailed=true;}
        localStorage.removeItem('gold-terminal-push-device');await signOut(auth);setUser(null);setProfile(null);
        if(cleanupFailed)setMessage('Signed out. Notification cleanup was incomplete; block this website’s notifications in browser settings on a shared device.');
      }
      setPassword('');
    }catch(error){setMessage(error.code?.startsWith('auth/') ? 'Sign-in could not finish. Check your details or use email sign-in if Google is blocked.' : error.message);}
    finally{setBusy(false);}
  }
  return <>
    <section className="terminal-card account-panel">
      <h2>{profile?.premium ? 'Trendline Insight Pro' : 'Your Trendline Insight account'}</h2>
      {user ? <><p>{user.email} · {profile?.premium ? profile.role==='owner'?'Owner access':'Pro access active':'Pro access not active'}</p>
        <p className="analysis-method">Account ID: {user.uid}</p>
        <button disabled={busy} onClick={()=>act('refresh')}>Refresh access</button>
        {profile?.role !== 'owner' && profile?.hasBillingCustomer && <button disabled={busy} onClick={()=>billing('portal')}>Manage billing</button>}
        {user.emailVerified && profile?.role !== 'owner' && !profile?.premium && <button disabled={busy} onClick={()=>billing('checkout')}>Upgrade to Pro · £25/month</button>}
        {!user.emailVerified && <button disabled={busy} onClick={()=>act('verify')}>Send verification email</button>}
        <button disabled={busy} onClick={()=>act('logout')}>Sign out</button></> : <>
        <div className="phone-alert-fields"><label>Email<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} /></label></div>
        <div className="phone-alert-actions"><button disabled={!ready||busy} onClick={()=>act('login')}>Sign in</button><button disabled={!ready||busy} onClick={()=>act('signup')}>Create account</button><button disabled={!ready||busy} onClick={()=>act('google')}>Continue with Google</button><button disabled={!ready||busy||!email} onClick={()=>act('reset')}>Reset password</button></div>
      </>}
      <p role="status">{busy?'Working…':message}</p>
      <p>Free account: sign up at no cost for the free preview. Pro: £25/month; secure checkout and billing management are handled by Stripe. You can keep using the free preview without adding payment details.</p>
    </section>
    {profile?.premium ? <div key={user.uid}>{children}</div> : <div className="account-preview"><FreePreview /></div>}
  </>;
}
