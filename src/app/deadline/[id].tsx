import { useLocalSearchParams } from 'expo-router';

import { DeadlineForm } from '@/components/DeadlineForm';

export default function EditDeadlineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DeadlineForm deadlineId={id} />;
}
