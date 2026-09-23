import { useEffect, useState } from 'react';
import './UserManagementScreen.css';
import adminApi, { UserInfo } from '../api/adminApi';
import { Toast } from './Toast';
import { BackendRestartNotification, useBackendRestartNotification } from './BackendRestartNotification';
import { fetchAuthSession } from 'aws-amplify/auth';

interface UserManagementScreenProps {
    onBack: () => void;
}

export function UserManagementScreen({ onBack }: UserManagementScreenProps) {
    const [users, setUsers] = useState<UserInfo[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [currentUsername, setCurrentUsername] = useState<string | null>(null);
    const { isOpen, retryCount } = useBackendRestartNotification();

    useEffect(() => {
        loadCurrentUsername();
        loadUsers();
    }, []);

    const loadCurrentUsername = async () => {
        try {
            const session = await fetchAuthSession();
            const token = session.tokens?.accessToken;
            if (token) {
                // Extract username from token payload - same way backend does it
                const username = token.payload.username as string;
                setCurrentUsername(username);
                console.log('Current username from token:', username);
            }
        } catch (error) {
            console.error('Failed to get current username:', error);
        }
    };

    const loadUsers = async () => {
        try {
            setLoading(true);
            const userList = await adminApi.listUsers();
            setUsers(userList);
        } catch (error) {
            console.error('Failed to load users:', error);
            showToast('Failed to load users', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleRole = async (username: string, groupName: string, currentlyInGroup: boolean) => {
        if (groupName === 'ADMIN' && username === currentUsername && currentlyInGroup) {
            showToast('Cannot remove yourself from ADMIN group', 'error');
            return;
        }

        const previousUsers = [...users];
        
        const updatedUsers = users.map(u => {
            if (u.username === username) {
                const newRoles = currentlyInGroup
                    ? u.roles.filter((r: string) => r !== groupName)
                    : [...u.roles, groupName];
                return { ...u, roles: newRoles };
            }
            return u;
        });
        setUsers(updatedUsers);

        try {
            if (currentlyInGroup) {
                await adminApi.removeUserFromGroup(username, groupName);
                showToast(`Removed ${username} from ${groupName}`, 'success');
            } else {
                await adminApi.addUserToGroup(username, groupName);
                showToast(`Added ${username} to ${groupName}`, 'success');
            }
        } catch (error) {
            console.error('Failed to update role:', error);
            setUsers(previousUsers);
            showToast('Failed to update role', 'error');
        }
    };

    const handleDeleteUser = (username: string) => {
        const userToDelete = users.find(u => u.username === username);
        if (!userToDelete) return;

        const confirmed = window.confirm(
            `Are you sure you want to delete user "${username}" (${userToDelete.email})?\n\nThis action cannot be undone.\n\nAll user data including likes and view history will be permanently deleted.`
        );

        if (!confirmed) return;

        deleteUserWithCleanup(username);
    };

    const deleteUserWithCleanup = async (username: string) => {
        const previousUsers = [...users];

        // Optimistic update - remove user from list
        const updatedUsers = users.filter(u => u.username !== username);
        setUsers(updatedUsers);

        try {
            await adminApi.deleteUser(username);
            showToast(`User "${username}" and all their data have been deleted`, 'success');
        } catch (error) {
            console.error('Failed to delete user:', error);
            setUsers(previousUsers);
            showToast('Failed to delete user', 'error');
        }
    };

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
    };

    return (
        <div className="user-management-screen">
            <BackendRestartNotification isOpen={isOpen} retryCount={retryCount} />
            <div className="user-management-header">
                <button className="back-button" onClick={onBack}>
                    ← Back
                </button>
                <h2>User Management</h2>
            </div>

            {loading ? (
                <div className="loading">Loading users...</div>
            ) : users.length === 0 ? (
                <div className="empty-state">No users found.</div>
            ) : (
                <div className="users-table-container">
                    <table className="users-table">
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Email</th>
                                <th>USER Role</th>
                                <th>ADMIN Role</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((userInfo) => {
                                const roles = userInfo.roles || [];
                                const isUser = roles.includes('USER');
                                const isAdmin = roles.includes('ADMIN');
                                const isSelf = userInfo.username === currentUsername;

                                return (
                                    <tr key={userInfo.username}>
                                        <td className="username-cell">
                                            {userInfo.username}
                                            {isSelf && <span className="self-badge"> (You)</span>}
                                        </td>
                                        <td className="email-cell">{userInfo.email}</td>
                                        <td className="role-cell">
                                            <label className="role-toggle">
                                                <input
                                                    type="checkbox"
                                                    checked={isUser}
                                                    onChange={() => handleToggleRole(userInfo.username, 'USER', isUser)}
                                                />
                                                <span className="toggle-label">
                                                    {isUser ? '✓ USER' : 'Add USER'}
                                                </span>
                                            </label>
                                        </td>
                                        <td className="role-cell">
                                            <label className="role-toggle">
                                                <input
                                                    type="checkbox"
                                                    checked={isAdmin}
                                                    onChange={() => handleToggleRole(userInfo.username, 'ADMIN', isAdmin)}
                                                    disabled={isSelf && isAdmin}
                                                    title={isSelf && isAdmin ? 'Cannot remove yourself from ADMIN' : ''}
                                                />
                                                <span className="toggle-label">
                                                    {isAdmin ? '✓ ADMIN' : 'Add ADMIN'}
                                                </span>
                                            </label>
                                        </td>
                                        <td className="actions-cell">
                                            <button
                                                className="delete-button"
                                                onClick={() => handleDeleteUser(userInfo.username)}
                                                disabled={isSelf}
                                                title={isSelf ? 'Cannot delete yourself' : 'Delete user'}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
}
