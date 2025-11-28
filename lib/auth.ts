import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getServerSession } from 'next-auth';

export { authOptions } from '@/app/api/auth/[...nextauth]/route';

export const getAuthSession = () => getServerSession(authOptions);

export const getRequiredAuthSession = async () => {
  const session = await getAuthSession();
  if (!session) {
    throw new Error('Not authenticated');
  }
  return session;
};
