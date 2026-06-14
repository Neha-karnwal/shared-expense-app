import { cookies } from 'next/headers';
import prisma from './db';
import { verifyPassword } from './hash';

/**
 * Log in a user by verifying their credentials and setting session cookies.
 * @param {string} username 
 * @param {string} password 
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function loginUser(username, password) {
  try {
    const user = await prisma.user.findUnique({
      where: { name: username }
    });
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return { success: false, error: 'Invalid password' };
    }
    
    // Set cookies
    const cookieStore = await cookies();
    cookieStore.set('session_user_id', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/'
    });
    cookieStore.set('session_user_name', user.name, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/'
    });
    
    return { success: true };
  } catch (err) {
    console.error('Login error:', err);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Log out the current user by deleting session cookies.
 */
export async function logoutUser() {
  const cookieStore = await cookies();
  cookieStore.delete('session_user_id');
  cookieStore.delete('session_user_name');
}

/**
 * Retrieve the currently logged in user profile.
 * @returns {Promise<Object|null>}
 */
export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('session_user_id')?.value;
    if (!userId) return null;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        createdAt: true
      }
    });
    
    return user;
  } catch (err) {
    console.error('Get current user error:', err);
    return null;
  }
}
