import { Redirect } from 'expo-router';

import { useSettings } from '@/store/settings';

/** Entry: send the operator to the first step they still need. */
export default function Index() {
  const operator = useSettings((s) => s.operator);
  const checkpointId = useSettings((s) => s.checkpointId);
  if (!operator) return <Redirect href="/login" />;
  if (!checkpointId) return <Redirect href="/checkpoint" />;
  return <Redirect href="/camera-setup" />;
}
