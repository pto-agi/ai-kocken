type StaffLike = {
  id: string;
  is_staff?: boolean | null;
  is_manager?: boolean | null;
};

export const resolveUniversalAgendaUserId = (
  staff: StaffLike[],
  fallbackUserId: string
) => {
  const nonManagerStaff = staff.find((member) => (
    Boolean(member.id) &&
    member.id !== fallbackUserId &&
    member.is_staff === true &&
    member.is_manager !== true
  ));
  if (nonManagerStaff) return nonManagerStaff.id;

  const firstOtherStaff = staff.find((member) => (
    Boolean(member.id) &&
    member.id !== fallbackUserId &&
    member.is_staff === true
  ));
  return firstOtherStaff?.id || fallbackUserId;
};
