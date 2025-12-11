export interface User {
  id: number;
  email: string;
  role: 'admin' | 'user';
  subscription?: {
    status: 'active' | 'expired' | 'none';
    endDate?: string;
    plan?: string;
  };
}

export function getUser(): User | null {
  const userStr = localStorage.getItem('user')
  return userStr ? JSON.parse(userStr) : null
}

export function isLoggedIn(): boolean {
  return !!getUser()
}

export async function logout(): Promise<void> {
  try {
    const response = await fetch('/logout.php')
    const data = await response.json()
    
    if (!data.success) {
      throw new Error('Logout failed')
    }
    
    // Clear local storage
    localStorage.removeItem('user')
    
  } catch (error) {
    console.error('Logout error:', error)
    // Still clear local storage even if server request fails
    localStorage.removeItem('user')
  }
} 