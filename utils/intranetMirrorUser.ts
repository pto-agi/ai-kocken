type StaffCandidate = {
  id: string;
  is_staff?: boolean | null;
  is_manager?: boolean | null;
};

export const resolveIntranetMirrorUserId = (input: {
  sessionUserId: string;
  isManager: boolean;
  staffCandidates: StaffCandidate[];
}) => {
  if (!input.isManager) return input.sessionUserId;

  const nonManagerStaff = input.staffCandidates.find((candidate) => (
    candidate.id !== input.sessionUserId &&
    candidate.is_staff === true &&
    candidate.is_manager !== true
  ));
  if (nonManagerStaff) return nonManagerStaff.id;

  const otherStaff = input.staffCandidates.find((candidate) => (
    candidate.id !== input.sessionUserId &&
    candidate.is_staff === true
  ));
  if (otherStaff) return otherStaff.id;

  return input.sessionUserId;
};
