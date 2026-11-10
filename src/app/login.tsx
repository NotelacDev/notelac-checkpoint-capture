import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/Logo';
import { Icon, NotchCard, PrimaryButton, T } from '@/components/ui';
import { DEMO_ACCOUNTS, findDemoAccount, type DemoAccount } from '@/data/demo';
import { loadDemoData } from '@/services/demoData';
import { capturesStore } from '@/store/captures';
import { setSettings } from '@/store/settings';
import { F, INK, LIME } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function Login() {
  const t = useTheme();
  const router = useRouter();
  const [cam] = useCameraPermissions();
  const [op, setOp] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [withSamples, setWithSamples] = useState(true);
  const [busy, setBusy] = useState(false);

  const signIn = async (account: DemoAccount) => {
    setBusy(true);
    setSettings({ operator: account.operator, checkpointId: account.checkpointId });
    if (withSamples && capturesStore.get().captures.length === 0) await loadDemoData().catch((e) => console.warn('sample data failed', e));
    setBusy(false);
    router.replace(cam?.granted ? '/camera-setup' : '/permissions');
  };

  const submit = () => {
    // Test accounts until the auth API exists — see src/data/demo.ts.
    if (!op.trim() || !pw) return setError('Enter your operator ID and password.');
    const account = findDemoAccount(op, pw);
    if (!account) return setError('Unknown operator ID or wrong password. Tap a test account below to sign in.');
    setError(null);
    void signIn(account);
  };

  const input = {
    fontFamily: F.semi,
    fontSize: 16,
    color: t.text,
    paddingVertical: 2,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
          <NotchCard notch={64} style={{ borderRadius: 28, gap: 44 }}>
            <Logo ink="dark" height={40} />
            <View style={{ gap: 8 }}>
              <T f="mono" size={11} color={INK} style={{ letterSpacing: 1.5 }}>
                CHECKPOINT CAPTURE
              </T>
              <T f="head" size={36} color={INK} style={{ lineHeight: 38, letterSpacing: -1 }}>
                Every runner, every checkpoint.
              </T>
            </View>
          </NotchCard>

          <View style={{ gap: 4, paddingHorizontal: 4, paddingTop: 6 }}>
            <T f="head" size={22}>
              Sign in
            </T>
            <T size={14} color={t.muted}>
              Use the operator account given by the race admin.
            </T>
          </View>

          <View style={{ backgroundColor: t.card, borderColor: t.line, borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, gap: 4 }}>
            <T f="semi" size={12} color={t.muted} nativeID="opLabel">
              Operator ID or email
            </T>
            <TextInput
              accessibilityLabelledBy="opLabel"
              value={op}
              onChangeText={setOp}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="e.g. op-0142"
              placeholderTextColor={t.muted}
              returnKeyType="next"
              style={input}
            />
          </View>
          <View style={{ backgroundColor: t.card, borderColor: t.line, borderWidth: 1, borderRadius: 18, paddingLeft: 16, paddingRight: 4, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, paddingVertical: 12, gap: 4 }}>
              <T f="semi" size={12} color={t.muted} nativeID="pwLabel">
                Password
              </T>
              <TextInput
                accessibilityLabelledBy="pwLabel"
                value={pw}
                onChangeText={setPw}
                secureTextEntry={!show}
                placeholder="••••••••"
                placeholderTextColor={t.muted}
                returnKeyType="go"
                onSubmitEditing={submit}
                style={input}
              />
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={show ? 'Hide password' : 'Show password'} onPress={() => setShow(!show)} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={show ? 'eye-off' : 'eye'} size={20} color={t.muted} />
            </Pressable>
          </View>
          {error ? (
            <T size={13} color="#D23F22" style={{ paddingHorizontal: 4 }}>
              {error}
            </T>
          ) : null}

          <View style={{ backgroundColor: t.card, borderColor: t.line, borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <T f="bold" size={12} color={t.muted} style={{ letterSpacing: 1 }}>
                TEST ACCOUNTS
              </T>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: withSamples }} onPress={() => setWithSamples(!withSamples)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name={withSamples ? 'check-square' : 'square'} size={16} color={t.text} />
                <T f="semi" size={12}>
                  Load sample photos
                </T>
              </Pressable>
            </View>
            {DEMO_ACCOUNTS.map((a) => (
              <Pressable
                key={a.operator}
                accessibilityRole="button"
                accessibilityLabel={`Sign in as ${a.label}`}
                disabled={busy}
                onPress={() => {
                  setOp(a.operator);
                  setPw(a.password);
                  void signIn(a);
                }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, backgroundColor: t.card2, opacity: pressed || busy ? 0.6 : 1 })}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="user" size={16} color={INK} />
                </View>
                <View style={{ flex: 1 }}>
                  <T f="semi" size={14}>
                    {a.operator}
                  </T>
                  <T size={12} color={t.muted}>
                    {a.label}
                  </T>
                </View>
                <Icon name="log-in" size={18} color={t.muted} />
              </Pressable>
            ))}
          </View>

          <View style={{ flex: 1 }} />
          <PrimaryButton label={busy ? 'Preparing sample data…' : 'Sign in'} onPress={submit} disabled={busy} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
            <T f="monoM" size={11} color={t.muted}>
              {Device.modelName ?? 'Device'}
            </T>
            <T f="monoM" size={11} color={t.muted}>
              v{Constants.expoConfig?.version ?? '0.1.0'}
            </T>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
