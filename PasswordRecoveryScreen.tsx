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
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      Alert.alert('Choose a stronger password', 'Use at least 8 characters, including a letter and a number.');
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
          <Pressable onPress={onCancel} accessibilityRole="button" style={styles.back}>
            <Text style={styles.backText}>‹  Back to sign in</Text>
          </Pressable>
          <View style={styles.brandRow}>
            <View style={styles.logo}><Text style={styles.logoText}>T</Text></View>
            <Text style={styles.brand}>Trade<Text style={styles.brandAccent}>Hub</Text></Text>
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
              <Pressable disabled={busy} style={[styles.primary, busy && styles.disabled]}
                onPress={sendEmail} accessibilityRole="button">
                <Text style={styles.primaryText}>{busy ? 'Sending…' : 'Send recovery email'}</Text>
              </Pressable>
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
              <Pressable disabled={busy} style={[styles.primary, busy && styles.disabled]}
                onPress={verifyRecovery} accessibilityRole="button">
                <Text style={styles.primaryText}>{busy ? 'Checking…' : 'Verify recovery details'}</Text>
              </Pressable>
              <Pressable onPress={() => setStep('request')} disabled={busy} style={styles.secondary}>
                <Text style={styles.secondaryText}>Request another email</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.label}>New password</Text>
              <TextInput value={password} onChangeText={setPassword}
                style={styles.input} secureTextEntry autoCapitalize="none"
                textContentType="newPassword" placeholder="At least 8 characters"
                placeholderTextColor="#92A0AB" />
              <Text style={styles.label}>Confirm new password</Text>
              <TextInput value={confirmPassword} onChangeText={setConfirmPassword}
                style={styles.input} secureTextEntry autoCapitalize="none"
                textContentType="newPassword" placeholder="Repeat your new password"
                placeholderTextColor="#92A0AB" />
              <Pressable disabled={busy} style={[styles.primary, busy && styles.disabled]}
                onPress={changePassword} accessibilityRole="button">
                <Text style={styles.primaryText}>{busy ? 'Saving…' : 'Save new password'}</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F3EC' },
  page: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 44 },
  back: { paddingVertical: 12, alignSelf: 'flex-start', marginBottom: 21 },
  backText: { color: '#315D76', fontWeight: '800', fontSize: 13 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 37 },
  logo: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#D66F4F', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  brand: { marginLeft: 10, color: '#111C29', fontSize: 25, fontWeight: '900' },
  brandAccent: { color: '#C86748' },
  eyebrow: { color: '#BB7259', fontSize: 10, letterSpacing: 1.5, fontWeight: '900', marginBottom: 9 },
  title: { color: '#142739', fontSize: 29, lineHeight: 35, fontWeight: '900', letterSpacing: -0.7 },
  sub: { color: '#657485', fontSize: 13, lineHeight: 21, marginTop: 11, marginBottom: 18 },
  label: { color: '#344659', fontSize: 12, fontWeight: '800', marginTop: 15, marginBottom: 8 },
  input: { minHeight: 54, borderRadius: 13, borderWidth: 1, borderColor: '#D9E0E2', backgroundColor: '#FFFEFA', color: '#1B3040', paddingHorizontal: 15, fontSize: 14 },
  longInput: { paddingTop: 12, paddingBottom: 12, minHeight: 90, textAlignVertical: 'top' },
  primary: { height: 55, backgroundColor: '#345D66', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 25 },
  primaryText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  disabled: { opacity: 0.6 },
  secondary: { alignItems: 'center', padding: 17, marginTop: 5 },
  secondaryText: { color: '#315D76', fontWeight: '800', fontSize: 12 },
  infoCard: { backgroundColor: '#E5EFF0', borderRadius: 13, padding: 15, marginTop: 7 },
  infoTitle: { color: '#254954', fontWeight: '900', fontSize: 12 },
  infoText: { color: '#587683', fontSize: 11, lineHeight: 17, marginTop: 6 },
});
