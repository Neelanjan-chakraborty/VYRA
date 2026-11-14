import { color, radius, space } from '@vyra/design-system';
import { StyleSheet, View } from 'react-native';
import { useApiHealth } from '@/features/system/use-api-health';
import { API_BASE_URL } from '@/lib/api';
import { Text } from './text';

function StatusRow({
  label,
  state,
}: {
  readonly label: string;
  readonly state: 'up' | 'down' | 'unknown';
}) {
  const tone = state === 'up' ? 'success' : state === 'down' ? 'danger' : 'textDisabled';
  const text = state === 'up' ? 'Connected' : state === 'down' ? 'Unavailable' : 'Checking';
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${text}`}>
      <Text variant="body">{label}</Text>
      {/* State is conveyed by text, not colour alone. */}
      <Text variant="bodyStrong" tone={tone}>
        {text}
      </Text>
    </View>
  );
}

/** Development-only panel showing live connectivity to the VYRA API. */
export function ServiceStatus() {
  const { data, isError, isPending } = useApiHealth();
  const api = isPending ? 'unknown' : isError ? 'down' : 'up';
  return (
    <View style={styles.panel}>
      <Text variant="eyebrow" tone="textSecondary">
        Development · service status
      </Text>
      <StatusRow label="API" state={api} />
      <StatusRow label="Database" state={data?.checks.database ?? (isError ? 'down' : 'unknown')} />
      <StatusRow
        label="Realtime store"
        state={data?.checks.redis ?? (isError ? 'down' : 'unknown')}
      />
      <Text variant="caption" tone="textSecondary" style={styles.footnote}>
        {API_BASE_URL}
        {data ? ` · v${data.version}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: space.xxl,
    paddingTop: space.l,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    borderRadius: radius.none,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  footnote: { marginTop: space.m },
});
