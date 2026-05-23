import React, { useState } from 'react';
import { useAzureAuth } from '../contexts/AzureAuthContext';
import './Login.scss';

interface AzureLoginProps {
    onCancel?: () => void;
}

export const AzureLogin: React.FC<AzureLoginProps> = ({ onCancel }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isRegister, setIsRegister] = useState(false);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [email, setEmail] = useState(''); // For registration only
    const [error, setError] = useState('');
    const { login, register, isLoading } = useAzureAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            if (isRegister) {
                if (password !== confirmPassword) {
                    setError('Passwords do not match');
                    return;
                }
                await register({ email, username, password, confirmPassword });
                // Registration successful - switch to login mode
                setIsRegister(false);
                setError('');
                // Clear form fields for login
                setPassword('');
                setConfirmPassword('');
                // Show success message (optional)
                console.log('Registration successful! Please login.');
            } else {
                await login(username, password);
            }
        } catch (error: any) {
            setError(error.response?.data?.message || 'An error occurred');
        }
    };

    return (
        <div className="auth-container">
            <h2>{isRegister ? 'Register' : 'Login'}</h2>
            {onCancel && (
                <button className="close-button" onClick={onCancel}>
                    ×
                </button>
            )}
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Username</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                </div>
                {isRegister && (
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                )}
                <div className="form-group">
                    <label>Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                {isRegister && (
                    <div className="form-group">
                        <label>Confirm Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>
                )}
                {error && <div className="error">{error}</div>}
                <button type="submit" disabled={isLoading}>
                    {isLoading ? 'Loading...' : (isRegister ? 'Register' : 'Login')}
                </button>
            </form>
            <p>
                {isRegister ? 'Already have an account?' : "Don't have an account?"}
                <button
                    type="button"
                    onClick={() => setIsRegister(!isRegister)}
                    className="link-button"
                >
                    {isRegister ? 'Login' : 'Register'}
                </button>
            </p>
        </div>
    );
};