import { auth, googleProvider } from '../utils/firebase';
import { signInWithPopup } from 'firebase/auth';

export default function Auth() {
  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="flex-center">
      <div className="auth-card center">
        {/* Same branding logo style as preloader */}
        <div className="brand-text" style={{marginBottom: '20px', display: 'inline-block'}}>
          <div className="text-gym" style={{fontSize: '36px'}}>GYM</div>
          <div className="text-saathi" style={{fontSize: '32px'}}>Saathi</div>
        </div>
        <p style={{color: '#64748b', marginBottom: '30px', fontSize: '16px'}}>Welcome back! Sign in to manage your gym.</p>
        
        <button onClick={handleGoogleLogin} className="btn-google">
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" style={{width:'24px'}} alt="Google" />
          Continue with Google
        </button>
      </div>
    </div>
  );
}