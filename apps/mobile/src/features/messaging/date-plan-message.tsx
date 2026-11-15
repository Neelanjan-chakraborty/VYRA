import { color, space } from '@vyra/design-system';
import type { MessageView } from '@vyra/validation';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { ChatIcon } from './chat-icons';

const PLAN_STATUS: Readonly<Record<string, string>> = {
  proposed: 'Waiting for an answer',
  accepted: 'You’re both in',
  declined: 'Not this time',
  withdrawn: 'Withdrawn',
};

const STATUS_DOT: Readonly<Record<string, string>> = {
  proposed: color.warning,
  accepted: color.success,
  declined: color.textDisabled,
  withdrawn: color.textDisabled,
};

interface DatePlanMessageProps {
  readonly message: MessageView;
  readonly mine: boolean;
  readonly canAct: boolean;
  readonly tint: string;
  readonly onPlan: (message: MessageView, action: 'accept' | 'decline' | 'withdraw') => void;
}

/** A date idea, presented as a card inside the conversation rather than a widget. */
export function DatePlanMessage({ message, mine, canAct, tint, onPlan }: DatePlanMessageProps) {
  const plan = message.plan;
  if (!plan) return <Text style={{ color: tint }}>Date idea unavailable</Text>;

  const statusTone = plan.status === 'accepted' && !mine ? color.chemistryText : tint;

  return (
    <View style={styles.card}>
      <View style={styles.eyebrowRow}>
        <ChatIcon name="calendar" color={mine ? tint : color.chemistryText} size={14} />
        <Text variant="eyebrow" style={{ color: mine ? tint : color.chemistryText }}>
          Date idea
        </Text>
      </View>
      <Text variant="title" style={{ color: tint }}>
        {plan.idea}
      </Text>
      {plan.when || plan.area ? (
        <View style={styles.facts}>
          {plan.when ? (
            <View style={styles.fact}>
              <ChatIcon name="clock" color={mine ? tint : color.textSecondary} size={14} />
              <Text variant="caption" style={{ color: mine ? tint : color.textSecondary }}>
                {plan.when}
              </Text>
            </View>
          ) : null}
          {plan.area ? (
            <View style={styles.fact}>
              <ChatIcon name="location" color={mine ? tint : color.textSecondary} size={14} />
              <Text variant="caption" style={{ color: mine ? tint : color.textSecondary }}>
                {plan.area}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={styles.status}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: STATUS_DOT[plan.status] ?? color.textDisabled },
          ]}
          aria-hidden
        />
        <Text variant="captionStrong" style={{ color: statusTone }}>
          {PLAN_STATUS[plan.status] ?? 'Date idea'}
        </Text>
      </View>
      {plan.status === 'accepted' ? (
        <Text variant="caption" style={{ color: mine ? tint : color.textSecondary }}>
          Meet somewhere public and let a friend know your plans.
        </Text>
      ) : null}
      {canAct && plan.status === 'proposed' && !mine ? (
        <View style={styles.actions}>
          <Button
            label="Not this time"
            variant="secondary"
            style={styles.action}
            onPress={() => onPlan(message, 'decline')}
          />
          <Button label="I’m in" style={styles.action} onPress={() => onPlan(message, 'accept')} />
        </View>
      ) : null}
      {canAct && plan.status === 'proposed' && mine ? (
        <Button
          label="Withdraw idea"
          variant="quiet"
          style={styles.withdraw}
          onPress={() => onPlan(message, 'withdraw')}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.xs, minWidth: 230 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.m, marginTop: space.xxs },
  fact: { flexDirection: 'row', alignItems: 'center', gap: space.xxs },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xxs },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  actions: { flexDirection: 'row', gap: space.s, marginTop: space.s },
  action: { flex: 1, paddingHorizontal: space.s },
  withdraw: { alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: space.xxs },
});
