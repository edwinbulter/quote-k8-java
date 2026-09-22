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
            if (u.Username === username) {
                const newRoles = currentlyInGroup
                    ? u.Roles.filter((r: string) => r !== groupName)
                    : [...u.Roles, groupName];
                return { ...u, Roles: newRoles };
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
        const userToDelete = users.find(u => u.Username === username);
        if (!userToDelete) return;

        const confirmed = window.confirm(
            `Are you sure you want to delete user "${username}" (${userToDelete.Email})?\n\nThis action cannot be undone.\n\nAll user data including likes and view history will be permanently deleted.`
        );

        if (!confirmed) return;

        deleteUserWithCleanup(username);
    };

    const deleteUserWithCleanup = async (username: string) => {
        const previousUsers = [...users];
        
        // Optimistic update - remove user from list
        const updatedUsers = users.filter(u => u.Username !== username);
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
                                const roles = userInfo.Roles || [];
                                const isUser = roles.includes('USER');
                                const isAdmin = roles.includes('ADMIN');
                                const isSelf = userInfo.Username === currentUsername;

                                return (
                                    <tr key={userInfo.Username}>
                                        <td className="username-cell">
                                            {userInfo.Username}
                                            {isSelf && <span className="self-badge"> (You)</span>}
                                        </td>
                                        <td className="email-cell">{userInfo.Email}</td>
                                        <td className="role-cell">
                                            <label className="role-toggle">
                                                <input
                                                    type="checkbox"
                                                    checked={isUser}
                                                    onChange={() => handleToggleRole(userInfo.Username, 'USER', isUser)}
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
                                                    onChange={() => handleToggleRole(userInfo.Username, 'ADMIN', isAdmin)}
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
                                                onClick={() => handleDeleteUser(userInfo.Username)}
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
