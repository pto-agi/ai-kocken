import { UserProfile } from '../types';

export const isManagerProfile = (profile: Partial<UserProfile> | null | undefined) => (
  profile?.is_manager === true
);
