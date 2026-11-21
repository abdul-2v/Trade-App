import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from './lib/supabase';
import { theme } from './theme';
import { MotionPressable, FadeSlideIn } from './Motion';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';

type Step = 'request' | 'verify' | 'new-password';

type Props = {
  initialEmail?: string;
  onCancel: () => void;
  onFinished: () => void;
};

const validEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value);

function readRecoveryProof(value: string): { token: string; isCode: boolean } | null {
  const trimmed = value.trim();
  if (/^\d{6}$/.test(trimmed)) return { token: trimmed, isCode: true };

  // The default Supabase recovery email contains a one-use verification URL.
  // Copying its link allows verification even in Expo Go, where native custom
  // deep links cannot be registered.
  if (/^https?:\/\//i.test(trimmed) || /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const token = url.searchParams.get('token_hash') || url.searchParams.get('token');
      const type = url.searchParams.get('type');
      if (type && type !== 'recovery') return null;
      if (token) return { token, isCode: false };
    } catch {
      return null;
    }
  }
  return null;
}

export default function PasswordRecoveryScreen({ initialEmail = '', onCancel, onFinished }: Props) {
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState(initialEmail.trim().toLowerCase());
  const [proof, setProof] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const sendEmail = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!validEmail(cleanEmail)) {
      Alert.alert('Check your email', 'Enter a valid email address.');
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      // Avoid a production-only redirect here. Supabase's emailed confirmation
      // link can be copied into this screen and verified on Expo Go as well.
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
      if (error) throw error;
      setEmail(cleanEmail);
      setStep('verify');
      Alert.alert('Check your inbox', 'If this email is registered, you will receive a password-reset email.');
    } catch (error: any) {
      Alert.alert('Could not send recovery email', error?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const verifyRecovery = async () => {
    const credentials = readRecoveryProof(proof);
    if (!credentials) {
      Alert.alert('Check the recovery details', 'Paste the complete reset link from your email, or enter its six-digit recovery code if one is shown.');
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const { error } = credentials.isCode
        ? await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: credentials.token, type: 'recovery' })
        : await supabase.auth.verifyOtp({ token_hash: credentials.token, type: 'recovery' });
      if (error) throw error;
      setProof('');
      setStep('new-password');
    } catch (error: any) {
      Alert.alert('Recovery link invalid', error?.message || 'Request a new email and try its latest link.');
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async () => {
    if (password.length < 12 || password.length > 128 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      Alert.alert('Choose a stronger password', 'Use 12–128 characters, including a letter and a number.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Enter your new password again.');
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword('');
      setConfirmPassword('');
      Alert.alert('Password updated', 'Your new password has been saved.', [
        { text: 'Continue', onPress: onFinished },
      ]);
    } catch (error: any) {
      Alert.alert('Could not update password', error?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <MotionPressable onPress={onCancel} accessibilityRole="button" style={styles.back}>
            <ArrowLeft size={19} strokeWidth={2} color={theme.colors.teal} />
             <Text style={styles.backText}>Back to sign in</Text>
          </MotionPressable>
          <View style={styles.brandRow}>
            <View style={styles.logo}><Text style={styles.logoText}>T</Text></View>
            <Text style={styles.brand}>Trad<Text style={styles.brandAccent}>arr</Text></Text>
          </View>
          <Text style={styles.eyebrow}>ACCOUNT SECURITY</Text>
          <Text style={styles.title}>
            {step === 'request' ? 'Reset your password'
              : step === 'verify' ? 'Check your inbox' : 'Choose a new password'}
          </Text>
          <Text style={styles.sub}>
            {step === 'request'
              ? "Enter the email linked to your account. We'll send you a secure recovery link."
              : step === 'verify'
                ? 'Copy the reset link from your latest recovery email and paste it below. If your email contains a six-digit code, you can enter that instead.'
                : 'Your recovery details have been verified. Set a new password to continue.'}
          </Text>

          {step === 'request' ? (
            <>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
                autoCorrect={false}
                placeholder="you@example.com"
                placeholderTextColor="#92A0AB"
              />
              <MotionPressable disabled={busy} style={[styles.primary, busy && styles.disabled]}
                onPress={sendEmail} accessibilityRole="button">
                <Text style={styles.primaryText}>{busy ? 'Sending…' : 'Send recovery email'}</Text><ArrowRight size={19} strokeWidth={2} color="#FFFFFF" />
              </MotionPressable>
            </>
          ) : step === 'verify' ? (
            <>
              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>Email sent to {email}</Text>
                <Text style={styles.infoText}>
                  Copy the link address without opening it first. Recovery links expire and work only once.
                </Text>
              </View>
              <Text style={styles.label}>Recovery link or code</Text>
              <TextInput
                value={proof}
                onChangeText={setProof}
                style={[styles.input, styles.longInput]}
                placeholder="Paste the link or enter a 6-digit code"
                placeholderTextColor="#92A0AB"
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                textContentType="oneTimeCode"
              />
              <MotionPressable disabled={busy} style={[styles.primary, busy && styles.disabled]}
                onPress={verifyRecovery} accessibilityRole="button">
                <Text style={styles.primaryText}>{busy ? 'Checking…' : 'Verify recovery details'}</Text><ArrowRight size={19} strokeWidth={2} color="#FFFFFF" />
              </MotionPressable>
              <MotionPressable onPress={() => setStep('request')} disabled={busy} style={styles.secondary}>
                <Text style={styles.secondaryText}>Request another email</Text>
              </MotionPressable>
            </>
          ) : (
            <>
              <Text style={styles.label}>New password</Text>
              <TextInput value={password} onChangeText={setPassword}
                style={styles.input} secureTextEntry autoCapitalize="none"
                textContentType="newPassword" maxLength={128} placeholder="12+ characters, a letter and a number"
                placeholderTextColor="#92A0AB" />
              <Text style={styles.label}>Confirm new password</Text>
              <TextInput value={confirmPassword} onChangeText={setConfirmPassword}
                style={styles.input} secureTextEntry autoCapitalize="none"
                textContentType="newPassword" maxLength={128} placeholder="Repeat your new password"
                placeholderTextColor="#92A0AB" />
              <MotionPressable disabled={busy} style={[styles.primary, busy && styles.disabled]}
                onPress={changePassword} accessibilityRole="button">
                <Text style={styles.primaryText}>{busy ? 'Saving…' : 'Save new password'}</Text><ArrowRight size={19} strokeWidth={2} color="#FFFFFF" />
              </MotionPressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.customerBackground },
  page: { paddingHorizontal: 25, paddingTop: 23, paddingBottom: 60 },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, alignSelf: 'flex-start', marginBottom: 23 },
  backText: { color: theme.colors.teal, fontWeight: '800', fontSize: 13 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 35 },
  logo: { width: 47, height: 47, borderRadius: 15, backgroundColor: theme.colors.coral, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  brand: { fontFamily:theme.font.heading, marginLeft: 11, color: theme.colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  brandAccent: { color: theme.colors.coralDark },
  eyebrow: { fontFamily:theme.font.heading, color: theme.colors.coralText, fontSize: 12, letterSpacing: 1.2, fontWeight: '800', marginBottom: 10 },
  title: { fontFamily:theme.font.editorial, color: theme.colors.ink, fontSize: 31, lineHeight: 39, fontWeight: '800', letterSpacing: -0.8 },
  sub: { color: theme.colors.muted, fontSize: 14, lineHeight: 22, marginTop: 11, marginBottom: 22 },
  label: { color: theme.colors.ink, fontSize: 13, fontWeight: '700', marginTop: 17, marginBottom: 9 },
  input: { minHeight: 56, borderRadius: 20, borderWidth: 1, borderColor: '#E4DED4', backgroundColor: '#FFFFFF', color: theme.colors.ink, paddingHorizontal: 16, fontSize: 15 },
  longInput: { paddingTop: 13, paddingBottom: 13, minHeight: 105, textAlignVertical: 'top' },
  primary: { minHeight: 56, backgroundColor: theme.colors.darkTeal, borderRadius: 28, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 11, marginTop: 26, ...theme.shadow },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  disabled: { opacity: 0.55 },
  secondary: { alignItems: 'center', justifyContent: 'center', minHeight: 48, paddingHorizontal: 15, marginTop: 8 },
  secondaryText: { color: theme.colors.teal, fontWeight: '800', fontSize: 13 },
  infoCard: { backgroundColor: '#FFFFFF', borderRadius: 25, padding: 19, marginTop: 8, ...theme.shadow },
  infoTitle: { color: theme.colors.ink, fontWeight: '800', fontSize: 15 },
  infoText: { color: theme.colors.muted, fontSize: 13, lineHeight: 20, marginTop: 7 },
});
